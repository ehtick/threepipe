import {EventListener2, Object3D} from 'three'
import {Class, onChange, serialize} from 'ts-browser-helpers'
import {AViewerPluginEventMap, AViewerPluginSync, ThreeViewer} from '../../viewer'
import {bindToValue, BoxSelectionWidget, ObjectPicker, SelectionWidget} from '../../three'
import {IMaterial, IObject3D, IScene, ISceneEventMap} from '../../core'
import {UiObjectConfig} from 'uiconfig.js'
import {FrameFadePlugin} from '../pipeline/FrameFadePlugin'
import {type UndoManagerPlugin} from './UndoManagerPlugin'
import {ObjectPickerEventMap} from '../../three/utils/ObjectPicker'
import {CameraViewPlugin} from '../animation/CameraViewPlugin'

export interface PickingPluginEventMap extends AViewerPluginEventMap, ObjectPickerEventMap{
}

export class PickingPlugin extends AViewerPluginSync<PickingPluginEventMap> {
    @serialize()
    @onChange(PickingPlugin.prototype.setDirty)
        enabled = true

    get picker(): ObjectPicker|undefined {
        return this._picker
    }
    static readonly PluginType = 'Picking'
    static readonly OldPluginType = 'PickingPlugin' // todo: swap
    private _picker?: ObjectPicker
    private _widget?: SelectionWidget
    private _hoverWidget?: SelectionWidget
    private _pickUi: boolean

    dependencies = [CameraViewPlugin]

    get hoverEnabled() {
        return this._picker?.hoverEnabled ?? false
    }
    set hoverEnabled(v: boolean) {
        if (!this._picker) return
        this._picker.hoverEnabled = v
        this.uiConfig && this.uiConfig.uiRefresh?.()
    }

    @bindToValue({obj: '_picker', key: 'selectionMode'})
        selectionMode: 'object' | 'material' = 'object'

    @serialize()
        autoFocus

    // @serialize()  // todo
    autoFocusHover = false

    /**
     * Note: this is for runtime use only, not serialized
     */
    @onChange(PickingPlugin.prototype._widgetEnabledChange)
        widgetEnabled = true

    protected _widgetEnabledChange() {
        if (!this._widget) return
        if (this.widgetEnabled && (this._picker?.selectedObject as IObject3D)?.isObject3D)
            this._widget.attach(this._picker!.selectedObject as IObject3D)
        else
            this._widget.detach()
        this.uiConfig?.uiRefresh?.(true)
    }

    setDirty() {
        if (!this._viewer) return
        if (this.isDisabled()) this.setSelectedObject(undefined)
        this._viewer.setDirty()
    }
    constructor(selection: Class<SelectionWidget>|undefined = BoxSelectionWidget, pickUi = true, autoFocus = false) {
        super()
        if (selection) {
            this._widget = new selection()
            this._hoverWidget = new selection()
            if (this._hoverWidget.lineMaterial) {
                this._hoverWidget.lineMaterial.linewidth! /= 2
                this._hoverWidget.lineMaterial.color!.set('#aa2222')
            }
        }
        this._pickUi = pickUi
        this.autoFocus = autoFocus
        this.dispatchEvent = this.dispatchEvent.bind(this)
    }

    getSelectedObject<T extends IObject3D|IMaterial = IObject3D|IMaterial>(): T|undefined {
        if (this.isDisabled()) return
        return this._picker?.selectedObject as T || undefined
    }

    setSelectedObject(object: IObject3D|IMaterial|undefined, focusCamera = false, trackUndo = true) { // todo: listen to object disposed
        const disabled = this.isDisabled()
        if (disabled && !object) return
        if (!this._picker) return
        const t = this.autoFocus
        this.autoFocus = false
        this._picker.setSelected(object || null, trackUndo)
        this.autoFocus = t
        if (!disabled && object && this.selectionMode === 'object' && (t || focusCamera)) this.focusObject(object as IObject3D)
    }

    onAdded(viewer: ThreeViewer): void {
        super.onAdded(viewer)
        this.setDirty()
        this._picker = new ObjectPicker(viewer.scene.modelRoot, viewer.canvas, viewer.scene.mainCamera, (obj)=>{
            const hasMat = obj.material
            if (!hasMat) return false
            let o: IObject3D|null = obj
            let ret = false
            while (o) {
                if (!o.visible) return false
                if (o.assetType === 'model' || o.assetType === 'light') ret = true
                if (o.assetType === 'widget') return false
                if (o.userData.userSelectable === false) return false
                if (o.userData.bboxVisible === false) return false
                // todo colorwrite?
                o = o.parent
            }
            return ret
        })
        if (this._widget) viewer.scene.addObject(this._widget, {addToRoot: true})
        if (this._hoverWidget) viewer.scene.addObject(this._hoverWidget, {addToRoot: true})

        this._picker.addEventListener('selectedObjectChanged', this._selectedObjectChanged)
        this._picker.addEventListener('hoverObjectChanged', this._hoverObjectChanged)
        this._picker.addEventListener('hitObject', this._onObjectHit)
        this._picker.addEventListener('selectionModeChanged', this._selectionModeChanged)

        // on material drop on selected object
        // viewer.scene.addEventListener('addSceneObject', async(e) => {
        //     const obj = e.object
        //     const selected: IModel<Mesh> = this.getSelectedObject()! as any
        //     if (selected
        //         && obj?.assetType === 'material'
        //         && typeof selected?.setMaterial === 'function'
        //         && selected?.modelObject?.isMesh
        //         && await viewer.confirm('Applying material: Apply material to the selected object?')
        //     ) {
        //         const oldMat = selected.material
        //         if (Array.isArray(oldMat)) {
        //             console.warn('Dropping on material array not yet fully supported.')
        //             selected.setMaterial(obj)
        //         } else {
        //             let meshes: IModel<Mesh>[] = Array.from(oldMat?.userData.__appliedMeshes ?? [])
        //             const c = meshes.length > 1 ? !await viewer.confirm('Applying material: Apply to all objects using this material?') : meshes.length < 1
        //             if (c) meshes = [selected]
        //             for (const mesh of meshes) {
        //                 if (mesh) mesh.setMaterial?.(obj)
        //             }
        //         }
        //     }
        // })
        viewer.scene.addEventListener('select', this._onObjectSelectEvent)
        viewer.scene.addEventListener('sceneUpdate', this._onSceneUpdate)
        viewer.scene.addEventListener('mainCameraChange', this._mainCameraChange)

        viewer.forPlugin<UndoManagerPlugin>('UndoManagerPlugin', (um)=>{
            if (!this._picker) return
            this._picker.undoManager = um.undoManager
        }, ()=>{
            if (!this._picker) return
            this._picker.undoManager = undefined
        })

    }

    onRemove(viewer: ThreeViewer) {
        viewer.scene.removeEventListener('select', this._onObjectSelectEvent)
        viewer.scene.removeEventListener('sceneUpdate', this._onSceneUpdate)
        viewer.scene.removeEventListener('mainCameraChange', this._mainCameraChange)

        this._widget?.removeFromParent()
        this._hoverWidget?.removeFromParent()

        if (this._picker) {
            this._picker.removeEventListener('selectedObjectChanged', this._selectedObjectChanged)
            this._picker.removeEventListener('hoverObjectChanged', this._hoverObjectChanged)
            this._picker.removeEventListener('hitObject', this._onObjectHit)
            this._picker.removeEventListener('selectionModeChanged', this._selectionModeChanged)
            this._picker.dispose()
            this._picker.undoManager = undefined // because setting above
            this._picker = undefined
        }
        super.onRemove(viewer)
    }

    dispose() {
        super.dispose()
        this._widget?.dispose()
        this._hoverWidget?.dispose()
    }

    private _mainCameraChange = ()=>{
        if (!this._picker || !this._viewer) return
        this._picker.camera = this._viewer.scene.mainCamera
    }

    private _sceneUpdated = false
    private _onSceneUpdate: EventListener2<'sceneUpdate', ISceneEventMap, IScene> = (e)=>{
        if (!e.hierarchyChanged) return
        this._sceneUpdated = true
    }

    private _checkSelectedInScene() {
        if (this.isDisabled() || !this._viewer) return
        const s = this.getSelectedObject()
        if (!s || !(s as IObject3D).isObject3D) return // ignoring checking for materials in scene
        let inScene = false
        ;(s as IObject3D).traverseAncestors((o) => {
            if (inScene || o !== this._viewer!.scene) return
            inScene = true
        })
        if (!inScene) this.setSelectedObject(undefined, false, false)
    }

    protected _viewerListeners = {
        preFrame: ()=>{
            if (!this._viewer || !this._picker) return
            if (this._sceneUpdated) {
                this._checkSelectedInScene()
                this._sceneUpdated = false
            }
        },
    }

    private _onObjectSelectEvent: EventListener2<'select', ISceneEventMap, IScene> = (e)=>{
        if (e.source === PickingPlugin.PluginType) return
        if (e.object === undefined && e.value === undefined) console.error('PickingPlugin - Error handling object/material `select` event `e.object` or `e.value` must be set for picking, `value` can be null to unselect')
        else this.setSelectedObject(e.object || e.value, this.autoFocus || e.focusCamera, true)
    }

    private _selectedObjectChanged: EventListener2<'selectedObjectChanged', ObjectPickerEventMap, ObjectPicker> = (e: any) => {
        if (!this._viewer) return
        this.dispatchEvent(e)

        const selected = this._picker?.selectedObject || undefined // or use e.object. doing this so that listeners can change the selected object in dispatch above

        const frameFade = this._viewer.getPlugin(FrameFadePlugin)
        if (frameFade) {
            if (selected) frameFade.disable(this)
            else frameFade.enable(this)
        }

        this._viewer.scene.autoNearFarEnabled = !selected // for widgets etc, this can be removed when they are rendered in a separate pass

        if (this._pickUi) {
            const ui = this.uiConfig
            ui.children = [...this._uiConfigChildren]
            if (selected) {
                if ((selected as IObject3D).isObject3D) {
                    const obj = (selected as IObject3D)
                    ui.children.push(
                        {
                            type: 'button',
                            label: 'Focus',
                            value: () => {
                                if (!obj.isObject3D) return
                                // const selected = this.getSelectedObject()
                                if (selected.assetType && obj.parentRoot) // todo also check if acceptChildEvents is set on some parent?
                                    obj.dispatchEvent({
                                        type: 'select',
                                        ui: true,
                                        object: obj,
                                        bubbleToParent: true,
                                        focusCamera: true,
                                    })
                                else
                                    this.setSelectedObject(obj, true)
                            },
                        },
                        {
                            type: 'button',
                            label: 'Select Parent',
                            hidden: () => !obj.parent,
                            value: () => {
                                if (!obj.isObject3D) return
                                const parent = obj.parent
                                if (parent) {
                                    if (parent.assetType && parent.parentRoot) // todo also check if acceptChildEvents is set on some parent?
                                        parent.dispatchEvent({
                                            type: 'select',
                                            ui: true,
                                            bubbleToParent: true,
                                            object: parent,
                                        })
                                    else
                                        this.setSelectedObject(parent, false)
                                }
                            },
                        },
                    )
                }
                let c = selected.uiConfig
                if (c) ui.children.push(c)
                else {
                    // check materials
                    const mats = (selected as IObject3D).materials ?? [(selected as IObject3D).material as IMaterial]
                    for (const m of mats) {
                        c = m?.uiConfig
                        if (c) ui.children.push(c)
                    }
                }
            }

            ui.uiRefresh?.()
        }

        const widget = this._widget
        if (widget && this.widgetEnabled) {
            if ((selected as IObject3D)?.isObject3D) widget.attach((selected as IObject3D))
            else widget.detach()
        }

        // if (selected) selected.dispatchEvent({type: 'selected', source: PickingPlugin.PluginType, object: selected})

        this._viewer.setDirty()

        if (this.autoFocus && this.selectionMode === 'object') {
            // this._viewer.resetCamera({rootObject: selected, centerOffset: new Vector3(4, 4, 4)})
            this.focusObject(selected as IObject3D | undefined)
        }

    }

    private _hoverObjectChanged = (e: any) => {
        if (!this._viewer) return
        this.dispatchEvent(e)
        const selected = this._picker?.hoverObject || undefined

        const widget = this._hoverWidget
        if (widget && this.widgetEnabled) {
            if ((selected as IObject3D)?.isObject3D) widget.attach((selected as IObject3D))
            else widget.detach()
        }

        // if (selected) selected.dispatchEvent({type: 'selected', source: PickingPlugin.PluginType, object: selected})

        this._viewer?.setDirty()

        if (this.autoFocusHover && this.selectionMode === 'object') {
            // this._viewer?.resetCamera({rootObject: selected, centerOffset: new Vector3(4, 4, 4)})
            this.focusObject(selected as IObject3D | undefined)
        }


    }

    private _onObjectHit = (e: any)=>{
        if (!this._viewer) return
        if (this.isDisabled()) {
            e.intersects.selectedObject = null
            return
        }
        this.dispatchEvent(e)
    }
    private _selectionModeChanged = (e: any)=>{
        if (!this._viewer) return
        this.dispatchEvent(e)
        if (this.isDisabled()) return
        this.uiConfig?.uiRefresh?.(true, 'postFrame', 1)
    }

    public async focusObject(selected?: Object3D|null) {
        this._viewer?.fitToView(selected ?? undefined, 1.25, 1000, 'easeOut')
    }

    private _uiConfigChildren: UiObjectConfig[] = [
        {
            label: 'Enabled',
            type: 'checkbox',
            property: [this, 'enabled'],
        },
        {
            label: 'Hover Enabled',
            type: 'checkbox',
            property: [this, 'hoverEnabled'],
            onChange: ()=>this.uiConfig.uiRefresh?.(true), // for autoFocusHover
        },
        // {
        //     label: 'Selection Mode',
        //     type: 'dropdown',
        //     children: ['object', 'material'].map(v=>({label: v, value: v})),
        //     onChange: ()=>this.uiConfig.uiRefresh?.(true),
        // },
        {
            label: 'Auto Focus',
            type: 'checkbox',
            property: [this, 'autoFocus'],
            onChange: ()=>{
                const o = this.getSelectedObject()
                if (this.autoFocus && o) this.setSelectedObject(o, true)
            },
        },
        {
            label: 'Auto Focus on Hover',
            type: 'checkbox',
            hidden: ()=>!this.hoverEnabled,
            property: [this, 'autoFocusHover'],
        },
        {
            label: 'Widget Enabled',
            type: 'checkbox',
            property: [this, 'widgetEnabled'],
        },
    ]

    uiConfig: UiObjectConfig = {
        type: 'panel',
        label: 'Picker',
        expanded: true,
        children: [
            ...this._uiConfigChildren,
        ],
    }

    get widget(): SelectionWidget | undefined {
        return this._widget
    }

}

