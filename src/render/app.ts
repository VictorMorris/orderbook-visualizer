import { Application, Graphics } from "pixi.js";

export const app = new Application();
await app.init({ resizeTo: window, background: '#0b0e14', antialias: true });
document.body.appendChild(app.canvas);