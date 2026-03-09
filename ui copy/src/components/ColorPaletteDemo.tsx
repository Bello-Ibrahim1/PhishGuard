/**
 * PhishGuard Color Palette Demo Component
 * 
 * This component displays all the colors used in the PhishGuard design system.
 * You can render this component to see and export the exact colors.
 */

export function ColorPaletteDemo() {
  const colors = {
    'Brand Colors': [
      { name: 'Cyber Blue', hex: '#3b82f6', rgb: 'rgb(59, 130, 246)', tailwind: 'blue-500' },
      { name: 'Deep Space Blue', hex: '#1e40af', rgb: 'rgb(30, 64, 175)', tailwind: 'blue-800' },
      { name: 'Electric Yellow', hex: '#fbbf24', rgb: 'rgb(251, 191, 36)', tailwind: 'yellow-400' },
      { name: 'Alert Orange', hex: '#f97316', rgb: 'rgb(249, 115, 22)', tailwind: 'orange-500' },
    ],
    'Backgrounds (Dark)': [
      { name: 'Primary BG', hex: '#020617', rgb: 'rgb(2, 6, 23)', tailwind: 'slate-950' },
      { name: 'Secondary BG', hex: '#0f172a', rgb: 'rgb(15, 23, 42)', tailwind: 'slate-900' },
      { name: 'Tertiary BG', hex: '#1e293b', rgb: 'rgb(30, 41, 59)', tailwind: 'slate-800' },
      { name: 'Card BG', hex: '#334155', rgb: 'rgb(51, 65, 85)', tailwind: 'slate-700' },
    ],
    'Status - Safe/Success': [
      { name: 'Safe Green', hex: '#22c55e', rgb: 'rgb(34, 197, 94)', tailwind: 'green-500' },
      { name: 'Safe Green Light', hex: '#86efac', rgb: 'rgb(134, 239, 172)', tailwind: 'green-400' },
      { name: 'Safe Green Dark', hex: '#16a34a', rgb: 'rgb(22, 163, 74)', tailwind: 'green-600' },
      { name: 'Safe BG', hex: 'rgba(34, 197, 94, 0.2)', rgb: 'rgba(34, 197, 94, 0.2)', tailwind: 'green-500/20' },
    ],
    'Status - Warning': [
      { name: 'Warning Yellow', hex: '#eab308', rgb: 'rgb(234, 179, 8)', tailwind: 'yellow-500' },
      { name: 'Warning Light', hex: '#fde047', rgb: 'rgb(253, 224, 71)', tailwind: 'yellow-400' },
      { name: 'Warning Orange', hex: '#f59e0b', rgb: 'rgb(245, 158, 11)', tailwind: 'orange-500' },
      { name: 'Warning BG', hex: 'rgba(234, 179, 8, 0.2)', rgb: 'rgba(234, 179, 8, 0.2)', tailwind: 'yellow-500/20' },
    ],
    'Status - Danger/Threat': [
      { name: 'Danger Red', hex: '#ef4444', rgb: 'rgb(239, 68, 68)', tailwind: 'red-500' },
      { name: 'Danger Light', hex: '#fca5a5', rgb: 'rgb(252, 165, 165)', tailwind: 'red-400' },
      { name: 'Danger Dark', hex: '#dc2626', rgb: 'rgb(220, 38, 38)', tailwind: 'red-600' },
      { name: 'Danger BG', hex: 'rgba(239, 68, 68, 0.2)', rgb: 'rgba(239, 68, 68, 0.2)', tailwind: 'red-500/20' },
    ],
    'Text Colors': [
      { name: 'Primary Text', hex: '#ffffff', rgb: 'rgb(255, 255, 255)', tailwind: 'white' },
      { name: 'Secondary Text', hex: '#cbd5e1', rgb: 'rgb(203, 213, 225)', tailwind: 'slate-300' },
      { name: 'Muted Text', hex: '#94a3b8', rgb: 'rgb(148, 163, 184)', tailwind: 'slate-400' },
      { name: 'Disabled Text', hex: '#64748b', rgb: 'rgb(100, 116, 139)', tailwind: 'slate-500' },
    ],
    'Accent Colors': [
      { name: 'Purple Accent', hex: '#a855f7', rgb: 'rgb(168, 85, 247)', tailwind: 'purple-500' },
      { name: 'Pink Accent', hex: '#ec4899', rgb: 'rgb(236, 72, 153)', tailwind: 'pink-500' },
      { name: 'Cyan Accent', hex: '#06b6d4', rgb: 'rgb(6, 182, 212)', tailwind: 'cyan-500' },
      { name: 'Indigo Accent', hex: '#6366f1', rgb: 'rgb(99, 102, 241)', tailwind: 'indigo-500' },
    ],
  };

  return (
    <div className="min-h-screen bg-slate-950 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="text-center mb-12">
          <h1 className="text-white text-4xl mb-2">PhishGuard Color Palette</h1>
          <p className="text-slate-400">Complete design system color reference</p>
        </div>

        {Object.entries(colors).map(([category, colorList]) => (
          <div key={category} className="space-y-4">
            <h2 className="text-white text-2xl border-b border-slate-700 pb-2">
              {category}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {colorList.map((color) => (
                <div
                  key={color.name}
                  className="bg-slate-800 rounded-xl overflow-hidden border border-slate-700 hover:border-slate-600 transition-colors"
                >
                  <div
                    className="h-32 w-full"
                    style={{ backgroundColor: color.hex }}
                  />
                  <div className="p-4 space-y-2">
                    <h3 className="text-white">{color.name}</h3>
                    <div className="space-y-1 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">HEX:</span>
                        <code className="text-slate-300 bg-slate-900 px-2 py-1 rounded">
                          {color.hex}
                        </code>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">RGB:</span>
                        <code className="text-slate-300 bg-slate-900 px-2 py-1 rounded text-xs">
                          {color.rgb}
                        </code>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Tailwind:</span>
                        <code className="text-blue-400 bg-slate-900 px-2 py-1 rounded text-xs">
                          {color.tailwind}
                        </code>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Gradients Section */}
        <div className="space-y-4">
          <h2 className="text-white text-2xl border-b border-slate-700 pb-2">
            Common Gradients
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl overflow-hidden border border-slate-700">
              <div className="h-32 w-full bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500" />
              <div className="bg-slate-800 p-4">
                <h3 className="text-white mb-2">Primary Button</h3>
                <code className="text-xs text-slate-300 bg-slate-900 px-2 py-1 rounded block">
                  from-yellow-500 via-orange-500 to-red-500
                </code>
              </div>
            </div>

            <div className="rounded-xl overflow-hidden border border-slate-700">
              <div className="h-32 w-full bg-gradient-to-br from-blue-600 to-purple-600" />
              <div className="bg-slate-800 p-4">
                <h3 className="text-white mb-2">Secondary Accent</h3>
                <code className="text-xs text-slate-300 bg-slate-900 px-2 py-1 rounded block">
                  from-blue-600 to-purple-600
                </code>
              </div>
            </div>

            <div className="rounded-xl overflow-hidden border border-slate-700">
              <div className="h-32 w-full bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900" />
              <div className="bg-slate-800 p-4">
                <h3 className="text-white mb-2">App Background</h3>
                <code className="text-xs text-slate-300 bg-slate-900 px-2 py-1 rounded block">
                  from-slate-950 via-blue-950 to-slate-900
                </code>
              </div>
            </div>

            <div className="rounded-xl overflow-hidden border border-slate-700">
              <div className="h-32 w-full bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900" />
              <div className="bg-slate-800 p-4">
                <h3 className="text-white mb-2">Header Gradient</h3>
                <code className="text-xs text-slate-300 bg-slate-900 px-2 py-1 rounded block">
                  from-slate-900 via-blue-900 to-indigo-900
                </code>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
