// Set the theme before first paint to avoid a flash: a stored choice wins, else the
// operating system preference. Kept as an external file (not inline) so it needs no
// script-src exception in the Content-Security-Policy.
(function () {
  try {
    var t = localStorage.getItem("ante-theme");
    if (t !== "dark" && t !== "light") {
      t = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    document.documentElement.setAttribute("data-theme", t);
  } catch (e) {
    document.documentElement.setAttribute("data-theme", "light");
  }
})();
