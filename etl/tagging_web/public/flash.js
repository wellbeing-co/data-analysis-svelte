document.addEventListener("DOMContentLoaded", () => {
  const flash = document.querySelector("[data-flash-overlay]")
  if (!flash) {
    return
  }

  window.setTimeout(() => {
    flash.classList.add("is-hiding")
    window.setTimeout(() => flash.remove(), 180)
  }, 3000)
})
