import { defineConfig } from 'vite'

export default defineConfig({
  optimizeDeps: { exclude: ['three'] },
  plugins: [{
    name: 'webxr-camera-layer',
    transform(code, id) {
      if (!id.endsWith('/three/build/three.module.js')) return

      const original = "supportsGlBinding && 'createProjectionLayer' in XRWebGLBinding.prototype"
      if (!code.includes(original)) {
        this.error('Проверьте выбор слоя WebXR после обновления Three.js.')
      }

      return code.replace(original, "session.environmentBlendMode !== 'alpha-blend' && " + original)
    }
  }]
})
