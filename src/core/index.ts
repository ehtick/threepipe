export {PerspectiveCamera2, PerspectiveCamera0} from './camera/PerspectiveCamera2'
export {CameraView, type ICameraView} from './camera/CameraView'
export {ExtendedShaderMaterial} from './material/ExtendedShaderMaterial'
export {PhysicalMaterial, type PhysicalMaterialEventTypes, MeshStandardMaterial2} from './material/PhysicalMaterial'
export {ShaderMaterial2} from './material/ShaderMaterial2'
export {ObjectShaderMaterial, type ObjectShaderMaterialEventTypes} from './material/ObjectShaderMaterial'
export {UnlitMaterial, type UnlitMaterialEventTypes, MeshBasicMaterial2} from './material/UnlitMaterial'
export {UnlitLineMaterial, type UnlitLineMaterialEventTypes, LineBasicMaterial2} from './material/UnlitLineMaterial'
export {LineMaterial2, type LineMaterial2EventTypes} from './material/LineMaterial2'
export {LegacyPhongMaterial, type PhongMaterialEventTypes} from './material/LegacyPhongMaterial'
export {Mesh2} from './object/Mesh2'
export {BufferGeometry2} from './geometry/BufferGeometry2'
export {AmbientLight2} from './light/AmbientLight2'
export {DirectionalLight2} from './light/DirectionalLight2'
export {HemisphereLight2} from './light/HemisphereLight2'
export {PointLight2} from './light/PointLight2'
export {RectAreaLight2} from './light/RectAreaLight2'
export {SpotLight2} from './light/SpotLight2'
export {iObjectCommons} from './object/iObjectCommons'
export {iCameraCommons} from './object/iCameraCommons'
export {iLightCommons} from './object/iLightCommons'
export {iGeometryCommons} from './geometry/iGeometryCommons'
export {iMaterialCommons} from './material/iMaterialCommons'
export {upgradeTexture} from './ITexture'
export {upgradeWebGLRenderer, setThreeRendererMode} from './IRenderer'
export {RootScene} from './object/RootScene'
export type {ICameraControls, TControlsCtor} from './camera/ICameraControls'
export type {ICamera, ICameraEvent, ICameraEventTypes, ICameraUserData, TCameraControlsMode, ICameraSetDirtyOptions} from './ICamera'
export type {IGeometry, IGeometryUserData, IGeometryEvent, IGeometryEventTypes, IGeometrySetDirtyOptions} from './IGeometry'
export type {IMaterial, IMaterialEvent, IMaterialEventTypes, IMaterialParameters, IMaterialUserData, IMaterialSetDirtyOptions, IMaterialTemplate, IMaterialGenerator} from './IMaterial'
export type {IObject3D, IObject3DEvent, IObjectSetDirtyOptions, IObjectProcessor, IObject3DEventTypes, IObject3DUserData} from './IObject'
export type {IRenderManager, IRenderManagerOptions, IWebGLRenderer, IRenderManagerEventTypes, IAnimationLoopEvent, TThreeRendererMode, TThreeRendererModeUserData, IRenderManagerUpdateEvent, IRenderManagerEvent, RendererBlitOptions} from './IRenderer'
export type {IScene, ISceneEvent, ISceneEventTypes, ISceneSetDirtyOptions, AddObjectOptions, ISceneUserData, IWidget} from './IScene'
export type {ITexture, ITextureUserData, ITextureEvent, ITextureEventTypes} from './ITexture'
export type {ILight, ILightEvent, ILightEventTypes} from './light/ILight'
