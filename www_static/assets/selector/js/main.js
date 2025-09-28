import { App } from "./app.js";

document.addEventListener('DOMContentLoaded', async () => {
    const appContainer = document.querySelector('.container')
    const mainApp = new App(appContainer)

    mainApp.render();
});