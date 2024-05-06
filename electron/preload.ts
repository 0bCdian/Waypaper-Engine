import { contextBridge } from "electron";
import { ELECTRON_API } from "./exposedApi";

contextBridge.exposeInMainWorld("API_RENDERER", ELECTRON_API);
