import { createExtensionRuntime, registerRuntimeListeners } from "./runtime/bootstrap.js";

const runtime = createExtensionRuntime(chrome);
registerRuntimeListeners(chrome, runtime);
