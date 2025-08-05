// plugins/database/plugins.js
import fs from 'fs'
import path from 'path'

const plugins = new Map()

const pluginsFolder = path.resolve('./plugins') // Adjust if your path is different

function loadPlugins() {
  plugins.clear()
  const pluginFiles = fs.readdirSync(pluginsFolder).filter(file => file.endsWith('.js'))

  for (const file of pluginFiles) {
    try {
      const pluginPath = path.join(pluginsFolder, file)
      const plugin = await import('file://' + pluginPath)
      const pluginName = plugin.default?.name || file.replace('.js', '')
      plugins.set(pluginName, plugin.default || plugin)
    } catch (err) {
      console.error(`[❌ Failed to load plugin] ${file}:`, err)
    }
  }
}

await loadPlugins()

export default plugins