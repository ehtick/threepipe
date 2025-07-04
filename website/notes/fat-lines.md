---
next:
  text: 'GLTF Fat/Mesh Lines'
  link: './gltf-mesh-lines'

prev: false
aside: false
---

# Fat Lines: Spiral Example

<iframe src="https://threepipe.org/examples/fat-line-spiral/" style="width:100%;height:600px;border:none;"></iframe>

This example shows how to use ThreePipe's fat lines (MeshLine) to draw a thick, colorful spiral. The spiral's shape and color are generated in code, and you can adjust its parameters live using the UI.

**How it works:**
- The spiral is made by calculating 3D positions in a loop, using radius, height, and loops for shape.
- Each point gets a color, creating a gradient from blue to red.
- `MeshLine` (an extension of three.js Line2) is used to make the line thick and support per-vertex colors.
- The UI lets you change the spiral's radius, height, and loops, and see updates instantly.

**Key code:**

```typescript
function makeSpiral(radius = 1, height = 2, loops = 10) {
    const positions = [], colors = []
    for (let i = 0; i <= 1000; i++) {
        const t = i / 1000, angle = t * Math.PI * 2 * loops
        positions.push(radius * Math.cos(angle), radius * Math.sin(angle), t * height - height/2)
        colors.push(t, 0, 1-t)
    }
    return {positions, colors}
}

const line = new MeshLine(new LineGeometry2(), new LineMaterial2())
line.material.vertexColors = true
line.material.linewidth = 5
function updateSpiral() {
    const {positions, colors} = makeSpiral(spiral.radius, spiral.height, spiral.loops)
    line.geometry.setPositions(positions)
    line.geometry.setColors(colors)
    line.material.setDirty()
}
```

The line and its controls are added to the UI with Tweakpane:

```typescript
ui.appendChild({
    type: 'folder',
    label: 'Spiral',
    children: generateUiConfig(spiral),
    onChange: updateSpiral,
})
ui.appendChild(line.uiConfig)
```

See the [full code here](https://github.com/repalash/threepipe/blob/master/examples/fat-line-spiral/script.ts), live example on [threepipe.org/examples](https://threepipe.org/examples/fat-line-spiral/).

::: warning
Fat lines (MeshLine) cannot be exported with glTF. If you want to create lines that can be exported as glTF lines, use three.js `Line` directly (for now).
:::

## Features of `MeshLine`

- **Adjustable thickness:** Unlike standard three.js lines, fat lines can be any width, not just 1 pixel.
- **Per-vertex color:** Supports gradients and color effects along the line.
- **UI integration:** Easily expose line and spiral parameters for live editing.
- **Performance:** Efficiently renders thousands of segments as a single mesh.

## How Fat Lines Work Under the Hood

ThreePipe's `MeshLine` is built on top of the three.js [Line2](https://threejs.org/docs/#examples/en/lines/Line2) addon. Instead of drawing a single-pixel line, it creates a mesh strip along the path, allowing for thick, anti-aliased lines. The geometry stores positions and colors, and the material handles width, color, and other effects. This approach works in all modern browsers and supports advanced features like dashes and transparency.

## When to Use `MeshLine`

Use fat lines when you need:
- Outlines, paths, or polylines with variable thickness
- Technical illustrations or stylized effects
- Color gradients or dashes along a line
- Interactive geometry that updates in real time
- Using as a viewer (not exporting as glTF)

For simple, single-pixel lines, the default three.js `Line` is still fastest, but for anything more advanced, `MeshLine` is the way to go.

## Using with glTF files

When importing glTF files with embedded line geometries and materials, `GLTFLoader2.UseMeshLines` feature can be used to automatically convert those lines to `MeshLine` instances. This allows you to take advantage of the advanced line rendering capabilities without needing to modify the original GLTF files.

Checkout the article on [GLTF Mesh Lines](https://threepipe.org/notes/gltf-mesh-lines) for more details on how to use this feature.
