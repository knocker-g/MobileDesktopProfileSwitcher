import { createExtensionRuntime, registerRuntimeListeners } from "./runtime/bootstrap.js";

const runtime = createExtensionRuntime(chrome);
registerRuntimeListeners(chrome, runtime);

// Module evaluation is also a recovery entry point after service-worker restart.
runtime.initialize().catch((error) => {
  console.error("MDPS service worker initialization failed", error);
});
