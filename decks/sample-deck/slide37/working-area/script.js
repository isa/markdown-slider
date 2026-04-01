const log = document.getElementById("log");
const btn = document.getElementById("go");
let n = 0;
btn.addEventListener("click", () => {
  n += 1;
  log.textContent = "clicks: " + n;
});
