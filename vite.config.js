import { defineConfig } from 'vite'

export default defineConfig({
  build: { rollupOptions: { input: { main: 'index.html', marker: 'marker.html' } } },
  optimizeDeps: { exclude: ['three', 'js-aruco2'] },
  plugins: [{
    name: 'aruco-module-exports',
    enforce: 'pre',
    transform(code, id) {
      if (!id.includes('/node_modules/js-aruco2/src/')) return
      return code
        .replace(/var (CV|SVD) = this\.\1 \|\| require\('\.\/(\w+)'\)\.\1;/g, "import { $1 } from './$2.js'")
        .replace(/^this\.(AR|CV|POS|SVD) = \1;/m, 'export { $1 }')
    }
  }, {
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
