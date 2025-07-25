import type {GLTF, GLTFLoaderPlugin, GLTFParser} from 'three/examples/jsm/loaders/GLTFLoader.js'
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js'
import {Line, LineLoop, LineSegments, LoadingManager, Object3D, Texture} from 'three'
import {AnyOptions, safeSetProperty} from 'ts-browser-helpers'
import {ThreeViewer} from '../../viewer'
import {generateUUID} from '../../three'
import {
    glbEncryptionPreparser,
    GLTFLightExtrasExtension,
    GLTFMaterialExtrasExtension,
    GLTFMaterialsAlphaMapExtension,
    GLTFMaterialsBumpMapExtension,
    GLTFMaterialsDisplacementMapExtension,
    GLTFMaterialsLightMapExtension,
    GLTFObject3DExtrasExtension,
    GLTFViewerConfigExtension,
} from '../gltf'
import {RootSceneImportResult} from '../IAssetImporter'
import {ILoader} from '../IImporter'
import {ThreeSerialization} from '../../utils'
import {
    DirectionalLight2,
    LineGeometry2,
    LineMaterial2,
    LineSegmentsGeometry2,
    MeshLine,
    MeshLineSegments,
    OrthographicCamera0,
    PerspectiveCamera0,
    PhysicalMaterial,
    PointLight2,
    SpotLight2,
    UnlitLineMaterial,
    UnlitMaterial,
} from '../../core'
import {AssetImporter} from '../AssetImporter'
import {ImportAddOptions} from '../AssetManager'

// todo move somewhere
const supportedEmbeddedFiles = ['hdr', 'exr', 'webp', 'avif', 'ktx', 'hdrpng', 'svg', 'cube', 'ico', 'bmp', 'gif', 'tiff'] // ktx2, drc handled separately

export class GLTFLoader2 extends GLTFLoader implements ILoader<GLTF, Object3D|undefined> {
    isGLTFLoader2 = true
    importOptions?: ImportAddOptions

    constructor(manager: LoadingManager) {
        super(manager)
        this.preparsers.push(glbEncryptionPreparser)

        GLTFLoader.ObjectConstructors.DirectionalLight = DirectionalLight2 as any
        GLTFLoader.ObjectConstructors.PointLight = PointLight2 as any
        GLTFLoader.ObjectConstructors.SpotLight = SpotLight2 as any
        GLTFLoader.ObjectConstructors.MeshStandardMaterial = PhysicalMaterial as any
        GLTFLoader.ObjectConstructors.MeshBasicMaterial = UnlitMaterial as any
        GLTFLoader.ObjectConstructors.MeshPhysicalMaterial = PhysicalMaterial as any
        GLTFLoader.ObjectConstructors.LineBasicMaterial = UnlitLineMaterial as any
        // GLTFLoader.ObjectConstructors.PointsMaterial = PointsMaterial2
        GLTFLoader.ObjectConstructors.PerspectiveCamera = PerspectiveCamera0 // todo set domElement in the AssetManager during process
        GLTFLoader.ObjectConstructors.OrthographicCamera = OrthographicCamera0 // todo
    }

    static ImportExtensions: ((parser: GLTFParser) => GLTFLoaderPlugin)[] = [
        GLTFObject3DExtrasExtension.Import,
        GLTFLightExtrasExtension.Import,
        GLTFMaterialsBumpMapExtension.Import,
        GLTFMaterialsDisplacementMapExtension.Import,
        GLTFMaterialsLightMapExtension.Import,
        GLTFMaterialsAlphaMapExtension.Import,
    ]

    /**
     * Use {@link MeshLine}(an extension of three.js `Line2`) instead of default `Line` for lines. This allows changing line width and other properties.
     *
     * This is the default value for the flag, it can also be controlled by using the `useMeshLines` in the import options.
     *
     * Note - Lines may not export correctly when loaded with this.
     */
    static UseMeshLines = false

    /**
     * Preparsers are run on the arraybuffer/string before parsing to read the glb/gltf data
     */
    preparsers: GLTFPreparser[] = []

    async preparse(data: ArrayBuffer | string, path: string): Promise<ArrayBuffer | string> {
        for (const preparser of this.preparsers) {
            data = await preparser.process(data, path)
        }
        return data
    }

    parse(data: ArrayBuffer | string, path: string, onLoad: (gltf: GLTF) => void, onError?: (event: ErrorEvent) => void, url?: string) {
        this.preparse.call(this, data, url || path)
            .then((res: ArrayBuffer|string) => {
                const val = Texture.DEFAULT_IMAGE

                // this will be used when doing new Texture(). Which is done for not found images or when some error happens in loading. See FBXLoader.
                // todo save the path of invalid textures, check if they can be found in the loaded libs, and ask the user in UI to remap it to something else manually
                if (!Texture.DEFAULT_IMAGE) Texture.DEFAULT_IMAGE = AssetImporter.WHITE_IMAGE_DATA

                const useMeshLines = this.importOptions?.useMeshLines ?? GLTFLoader2.UseMeshLines
                GLTFLoader.ObjectConstructors.LineBasicMaterial = useMeshLines ? LineMaterial2 as any : UnlitLineMaterial as any

                return res ? super.parse(res, path, (ret)=>{
                    Texture.DEFAULT_IMAGE = val
                    GLTFLoader.ObjectConstructors.LineBasicMaterial = useMeshLines ? LineMaterial2 as any : UnlitLineMaterial as any
                    onLoad && onLoad(ret)
                }, onError) : onError && onError(new ErrorEvent('no data'))
            })
            .catch((e: any) => {
                console.error(e)
                if (onError) onError(e ?? new ErrorEvent('unknown error'))
            })
    }

    /**
     * This is run post parse to extract the result scene from the GLTF object
     * @param res
     * @param _
     */
    transform(res: GLTF, _: AnyOptions): Object3D|undefined {
        // todo: support loading of multiple scenes?
        const scene: RootSceneImportResult|undefined = res ? res.scene || !!res.scenes && res.scenes.length > 0 && res.scenes[0] : undefined as any
        if (!scene) return undefined
        if (res.animations.length > 0) scene.animations = res.animations

        const useMeshLines = this.importOptions?.useMeshLines ?? GLTFLoader2.UseMeshLines
        // todo: move out and put the chosen setting in userData.
        if (useMeshLines) {
            const lines: Line[] = []
            scene.traverse((node: Object3D) => {
                if (node.userData.gltfUUID) { // saved in GLTFExporter2
                    safeSetProperty(node, 'uuid', node.userData.gltfUUID, true, true)
                    delete node.userData.gltfUUID // have issue with cloning if we don't dispose.
                }
                if ((node as Line).isLine) lines.push(node as Line)
            })

            // convert lines to mesh/fat lines
            for (const line of lines) {
                convertToFatLine(line)
            }
        }

        // todo: replacing lights and camera, todo: remove and change constructors in GLTFLoader.js
        if (!scene.userData) scene.userData = {}
        if (res.userData) scene.userData.gltfExtras = res.userData // todo: put back in gltf in GLTFExporter2
        if (res.cameras) res.cameras.forEach(c => !c.parent && scene.add(c))
        if (res.asset) scene.userData.gltfAsset = res.asset // todo: put back in gltf in GLTFExporter2

        return scene
    }

    register(callback: (parser: GLTFParser) => GLTFLoaderPlugin): this {
        return super.register(callback) as this
    }

    setup(viewer: ThreeViewer, extraExtensions: ((parser: GLTFParser) => GLTFLoaderPlugin)[]): this {
        this.register(GLTFMaterialExtrasExtension.Import(viewer.loadConfigResources))
        for (const ext of extraExtensions) this.register(ext)

        for (const ext of GLTFLoader2.ImportExtensions) this.register(ext)

        // Note: this should be last
        this.register(this.gltfViewerParser(viewer))

        return this
    }

    // loads the viewer config and handles loading the draco loader for extension
    gltfViewerParser = (viewer: ThreeViewer): (p: GLTFParser)=>GLTFLoaderPlugin => {
        return (parser: GLTFParser) => {
            parser.importOptions = this.importOptions || undefined
            const getDependency = parser.getDependency
            parser.getDependency = async(type: string, index: number) => {
                const res = await getDependency.call(parser, type, index)
                if (res && res.userData) {
                    const gltfExtensions = res.userData.gltfExtensions
                    delete res.userData.gltfExtensions
                    res.userData = ThreeSerialization.Deserialize(res.userData, {})
                    res.userData.gltfExtensions = gltfExtensions
                }
                return res
            }
            const tempPathDrc = generateUUID() + '.drc'
            const tempPathKtx2 = generateUUID() + '.ktx2'
            const needsDrc = parser.json?.extensionsRequired?.includes?.('KHR_draco_mesh_compression')
            if (needsDrc) {
                const drc = viewer.assetManager.importer.registerFile(tempPathDrc)
                drc && this.setDRACOLoader(drc as any) // todo: check class?
            }
            const needsMeshOpt = parser.json?.extensionsUsed?.includes?.('EXT_meshopt_compression')
            if (needsMeshOpt) {
                if (window.MeshoptDecoder) { // added by the plugin or by the user
                    this.setMeshoptDecoder(window.MeshoptDecoder)
                    parser.options.meshoptDecoder = window.MeshoptDecoder
                } else {
                    console.error('Add GLTFMeshOptDecodePlugin(and initialize it) to viewer to enable EXT_meshopt_compression decode')
                }
            }

            // create ktx2 loader so it can be used with getHandler, we need to do this even when extension is not used since we dont know
            const ktx2 = viewer.assetManager.importer.registerFile(tempPathKtx2)
            // const needsBasisU = parser.json?.extensionsUsed?.includes?.('KHR_texture_basisu')
            // if (needsBasisU) {
            // const ktx2 = viewer.assetManager.importer.registerFile(tempPathKtx2)
            if (ktx2) {
                this.setKTX2Loader(ktx2 as any) // todo: check class?
                parser.options.ktx2Loader = ktx2 as any
            }
            // }

            // registering temp file creates and makes a loader available to the loading manager of that type
            const tempFiles = supportedEmbeddedFiles.map(f=>generateUUID() + '.' + f)
            tempFiles.forEach(f=>viewer.assetManager.importer.registerFile(f))

            return {name: 'GLTF2_HELPER_PLUGIN', afterRoot: async(result: GLTF) => {
                if (needsDrc) viewer.assetManager.importer.unregisterFile(tempPathDrc)
                if (ktx2) viewer.assetManager.importer.unregisterFile(tempPathKtx2)
                tempFiles.forEach(f=>viewer.assetManager.importer.unregisterFile(f))

                await GLTFViewerConfigExtension.ImportViewerConfig(parser, viewer, result.scenes || [result.scene])
            }}
        }
    }
}

export interface GLTFPreparser{
    process(data: string | ArrayBuffer, path: string): Promise<string | ArrayBuffer>
    [key: string]: any
}

// sample test model - https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/refs/heads/main/Models/MeshPrimitiveModes/glTF/MeshPrimitiveModes.gltf
// todo maybe do the same as others inside GLTFLoader.js
function convertToFatLine(line: Line) {
    const parent = line.parent
    if (!parent) {
        console.warn('GLTFLoader2: Line has no parent', line)
        return
    }
    if (line.geometry.index) line.geometry = line.geometry.toNonIndexed() // Line2 requires non indexed
    const line2 =
        (line as LineSegments).isLineSegments ?
            new MeshLineSegments(new LineSegmentsGeometry2(), line.material as LineMaterial2) :
            new MeshLine(new LineGeometry2(), line.material as LineMaterial2)
    let positions = line.geometry.attributes.position.array as Float32Array
    if ((line as LineLoop).isLineLoop) {
        // add first pos as last.
        const pos = new Float32Array(positions.length + 3)
        pos.set(positions)
        pos.set(positions.subarray(0, 3), positions.length)
        positions = pos
    }
    line2.geometry.setPositions(positions)
    line2.computeLineDistances()
    const index = parent.children.indexOf(line)
    parent.add(line2)
    const {geometry, material} = line2
    const ud = line.userData
    line.userData = {}
    line2.copy(line as any, false)
    line2.geometry = geometry
    line2.material = material
    ;[...line.children].map(c => {
        line2.add(c)
    })
    line2.userData = {...line2.userData, ...ud}
    material.userData.renderToGBuffer = false // this is set in LineMaterial2
    material.userData.renderToDepth = false
    line.removeFromParent()
    // put at the same index
    const index2 = parent.children.indexOf(line2)
    if (index2 >= 0 && index2 !== index) {
        parent.children.splice(index2, 1)
        parent.children.splice(index, 0, line2)
    }
}

declare module 'three/examples/jsm/loaders/GLTFLoader.js'{
    export interface GLTFParser {
        importOptions?: ImportAddOptions
        // getDependency(type: string, index: number): Promise<Object3D|Texture|Line|LineSegments|LineLoop>
    }
}
