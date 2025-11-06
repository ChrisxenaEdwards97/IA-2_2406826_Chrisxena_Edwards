/* IA 2 - JS */

/* LocalStorage keys*/
const LS_USERS   = "os_users";
const LS_ME      = "os_current_user";
const LS_CART    = "os_cart";
const LS_RECEIPT = "os_last_receipt";

/* Small helper shortcuts */
const qs  = (s) => document.querySelector(s);
const qsa = (s) => document.querySelectorAll(s);
const load = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};
const save = (key, value) => localStorage.setItem(key, JSON.stringify(value));

/* User display / auth  */
// show "Signed in as ..." or "Not signed in"
function showUser() {
  const me = load(LS_ME, null);
  const box = qs("#userBox");
  if (box) box.textContent = me ? ("Signed in as " + me.fullname) : "Not signed in";
}

// clear current user and go home
function logout() {
  localStorage.removeItem(LS_ME);
  window.location.href = "index.html";
}

/* Register*/
function handleRegister(form) {
  const name  = form.fullname?.value.trim();
  const dob   = form.dob?.value.trim();
  const email = form.email?.value.trim();
  const user  = form.username?.value.trim();
  const pass  = form.password?.value.trim();
  const err   = qs("#registerErrors");
  if (err) err.textContent = "";

  // basic checks
  if (!name || !dob || !email || !user || !pass) {
    if (err) err.textContent = "Please fill in all fields.";
    return false;
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    if (err) err.textContent = "Please enter a valid email.";
    return false;
  }
  if (pass.length < 4) {
    if (err) err.textContent = "Password must be at least 4 characters.";
    return false;
  }

  // unique username
  const users = load(LS_USERS, []);
  if (users.find(u => u.username === user)) {
    if (err) err.textContent = "That username already exists.";
    return false;
  }

  // save user and go to login
  users.push({ fullname: name, dob, email, username: user, password: pass });
  save(LS_USERS, users);
  alert("Registration successful! You can log in now.");
  window.location.href = "login.html";
  return false;
}

/*Login*/
function handleLogin(form) {
  const user = form.username?.value.trim();
  const pass = form.password?.value.trim();
  const err  = qs("#loginErrors");
  if (err) err.textContent = "";

  if (!user || !pass) {
    if (err) err.textContent = "Please enter username and password.";
    return false;
  }
  const users = load(LS_USERS, []);
  const match = users.find(u => u.username === user && u.password === pass);
  if (!match) {
    if (err) err.textContent = "Invalid username or password.";
    return false;
  }
  save(LS_ME, { username: match.username, fullname: match.fullname });
  alert("Welcome, " + match.fullname + "!");
  window.location.href = "index.html";
  return false;
}

/*Cart*/
// get/set cart as an array of {id, name, price, qty}
function getCart() { return load(LS_CART, []); }
function setCart(c) { save(LS_CART, c); }

// add one unit of an item to the cart
function addToCart(item) {
  const cart = getCart();
  const found = cart.find(x => x.id === item.id);
  if (found) { found.qty += 1; }
  else { cart.push({ id: item.id, name: item.name, price: item.price, qty: 1 }); }
  setCart(cart);

  const note = qs("#cartNotice");
  if (note) {
    note.textContent = "Added to cart: " + item.name;
    setTimeout(() => note.textContent = "", 1500);
  }
  renderCartIfPresent(); // update table/totals if we're on cart/checkout
}

// get totals from cart
function computeTotals(cart) {
  const subtotal = cart.reduce((s, it) => s + it.price * it.qty, 0);
  const discount = subtotal >= 100 ? subtotal * 0.10 : 0; // simple 10% discount over $100
  const taxed    = subtotal - discount;
  const tax      = taxed * 0.15; // 15% tax
  const total    = taxed + tax;
  return { subtotal, discount, tax, total };
}

// rebuilds the cart table if the page has #cartBody
function renderCartIfPresent() {
  const body = qs("#cartBody");
  if (!body) return;

  const cart = getCart();
  body.innerHTML = "";
  cart.forEach(it => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${it.name}</td>
      <td>$${it.price.toFixed(2)}</td>
      <td><input type="number" min="1" value="${it.qty}" aria-label="Quantity for ${it.name}"></td>
      <td>$${(it.price * it.qty).toFixed(2)}</td>
      <td><button class="btn warning" data-remove="${it.id}">Remove</button></td>
    `;
    body.appendChild(tr);

    // qty change
    tr.querySelector("input").addEventListener("change", (e) => {
      it.qty = Math.max(1, parseInt(e.target.value || "1", 10));
      setCart(cart);
      renderCartIfPresent();
    });

    // remove item
    tr.querySelector("[data-remove]").addEventListener("click", () => {
      const keep = cart.filter(x => x.id !== it.id);
      setCart(keep);
      renderCartIfPresent();
    });
  });

  // footer totals
  const t = computeTotals(cart);
  if (qs("#ftSubtotal")) qs("#ftSubtotal").textContent = "$" + t.subtotal.toFixed(2);
  if (qs("#ftDiscount")) qs("#ftDiscount").textContent = "-$" + t.discount.toFixed(2);
  if (qs("#ftTax"))      qs("#ftTax").textContent      = "$" + t.tax.toFixed(2);
  if (qs("#ftTotal"))    qs("#ftTotal").textContent    = "$" + t.total.toFixed(2);
}

/*Checkout*/
// returns a date and N business days (skips Sat/Sun)
function addBusinessDays(baseDate, days) {
  const d = new Date(baseDate.getTime());
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    const w = d.getDay();
    if (w !== 0 && w !== 6) added++;
  }
  return d;
}

// submit the checkout form (validates, stores receipt, clears cart)
function handleCheckout(form) {
  const me = load(LS_ME, null);
  if (!me) { window.location.href = "login.html"; return false; }

  const name = form.shippingName?.value.trim();
  const addr = form.address?.value.trim();
  const err  = qs("#checkoutErrors");

  const cardName   = form.cardName?.value.trim();
  const cardNumber = form.cardNumber?.value.trim();
  const expiry     = form.expiry?.value.trim();
  const cvv        = form.cvv?.value.trim();

  if (err) err.textContent = "";

  // shipping info
  if (!name || !addr) {
    if (err) err.textContent = "Please enter your name and address.";
    return false;
  }

  //  card checks
  if (!cardName) { if (err) err.textContent = "Please enter the cardholder name."; return false; }
  if (!/^[0-9]{12,19}$/.test((cardNumber || "").replace(/\s+/g, ""))) { if (err) err.textContent = "Enter a valid card number (digits only)."; return false; }
  if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(expiry || "")) { if (err) err.textContent = "Expiry must be MM/YY."; return false; }
  if (!/^\d{3,4}$/.test(cvv || "")) { if (err) err.textContent = "Enter a valid CVV (3-4 digits)."; return false; }

  // must have items
  const cart = getCart();
  if (!cart.length) { if (err) err.textContent = "Your cart is empty."; return false; }

  // final totals
  const t = computeTotals(cart);

  // store receipt 
  save(LS_RECEIPT, {
    id: "R" + Date.now(),
    name,
    address: addr,
    items: getCart(),
    totals: t,
    when: new Date().toISOString(),
    ship: addBusinessDays(new Date(), 2).toISOString()
  });

  // clear cart  and go to receipt
  localStorage.removeItem(LS_CART);
  window.location.href = "receipt.html";
  return false;
}

/* Receipt helpers */
function money(n) { return "$" + (n || 0).toFixed(2); }
function fmt(iso) { const d = new Date(iso); return d.toLocaleString(); }

// reads LS_RECEIPT and fills in the receipt page
function loadReceipt() {
  const data = load(LS_RECEIPT, null);

  if (!data) {
    const card = qs(".card");
    if (card) card.innerHTML = "<p>No receipt found.</p><a class='btn' href='index.html'>Go Home</a>";
    return;
  }

  // tiny setter
  const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

  // header fields
  setText("rId",  "Receipt # " + (data.id || ("R" + Date.now())));
  setText("rName", data.name || "");
  setText("rAddr", data.address || "");
  setText("rDate", fmt(data.when || new Date().toISOString()));
  setText("rShip", fmt(data.ship || new Date().toISOString()));

  // items
  const itemsTbody = document.getElementById("rItems");
  if (itemsTbody) {
    const items = (data.items || []).map(it =>
      `<tr><td>${it.name}</td><td>${money(it.price)}</td><td>${it.qty}</td><td>${money(it.price * it.qty)}</td></tr>`
    ).join("");
    itemsTbody.innerHTML = items || "<tr><td colspan='4'>No items</td></tr>";
  }

  // totals
  const t = data.totals || { subtotal: 0, discount: 0, tax: 0, total: 0 };
  setText("rSub", money(t.subtotal));
  setText("rDis", "-" + money(t.discount));
  setText("rTax", money(t.tax));
  setText("rTot", money(t.total));

  const printBtn = document.getElementById("printBtn");
  if (printBtn) printBtn.addEventListener("click", () => window.print());
}

/* Page wiring (runs after the page loads) */
document.addEventListener("DOMContentLoaded", () => {
  // top bar
  showUser();

  // mobile menu button
  const burger = qs("#menuToggle");
  const nav    = qs("#siteNav") || qs(".nav");
  if (burger && nav) {
    burger.addEventListener("click", (e) => {
      e.preventDefault();
      const open = nav.classList.toggle("is-open");
      burger.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  // cart table (if present)
  renderCartIfPresent();

  // register/login buttons
  const reg = qs("#registerForm"); if (reg) reg.addEventListener("submit", (e) => { e.preventDefault(); handleRegister(reg); });
  const log = qs("#loginForm");    if (log) log.addEventListener("submit", (e) => { e.preventDefault(); handleLogin(log); });
  const out = qs("#logoutBtn");    if (out) out.addEventListener("click", logout);

  // checkout form
  const chk = qs("#checkoutForm");
  if (chk) {
    const me = load(LS_ME, null);
    if (!me) { window.location.href = "login.html"; return; } // enforce login
    chk.addEventListener("submit", (e) => { e.preventDefault(); handleCheckout(chk); });
  }

  // small utility buttons 
  const clear = qs("#clearCartBtn"); if (clear) clear.addEventListener("click", () => { localStorage.removeItem(LS_CART); renderCartIfPresent(); });
  const go    = qs("#goCheckoutBtn"); if (go) go.addEventListener("click", () => { const me = load(LS_ME, null); window.location.href = me ? "checkout.html" : "login.html"; });
  const cancelBtn = qs("#cancelCheckoutBtn"); if (cancelBtn) cancelBtn.addEventListener("click", () => { window.location.href = "cart.html"; });
  const clearBtn  = qs("#clearAllCheckoutBtn"); if (clearBtn) clearBtn.addEventListener("click", () => { localStorage.removeItem(LS_CART); renderCartIfPresent(); });
  const closeBtn  = qs("#closeCheckoutBtn"); if (closeBtn) closeBtn.addEventListener("click", () => { window.location.href = "index.html"; });

  // add-to-cart 
  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-add]");
    if (!t) return;
    try { addToCart(JSON.parse(t.getAttribute("data-add"))); } catch (_) {}
  });

  // if this page is the receipt page, load the data
  if (document.body.dataset.page === "receiptA") {
    loadReceipt();
  }
});
