import "./index.css";
import { render } from "react-dom";
import { App } from "./App";
import { registerSW } from 'virtual:pwa-register';

// Register PWA service worker
registerSW({ immediate: true });

render(<App />, document.getElementById("root"));