import {Light, LightShadow, Object3D} from 'three'
import {IObject3D, IObject3DEvent, IObject3DEventTypes, IObject3DUserData} from '../IObject'

export interface ILight<
    TShadowSupport extends LightShadow | undefined = LightShadow | undefined,
    E extends ILightEvent = ILightEvent,
    ET extends ILightEventTypes = ILightEventTypes
// @ts-expect-error update three-ts-types
> extends Light<TShadowSupport, E, ET>, IObject3D<E, ET> {
    assetType: 'light'
    readonly isLight: true

    /**
     * @deprecated use `this` instead
     */
    lightObject: this

    // Note: for userData: add _ in front of for private use, which is preserved while cloning but not serialisation, and __ for private use, which is not preserved while cloning and serialisation
    userData: IObject3DUserData

    /**
     * @param removeFromParent - remove from parent. Default true
     */
    dispose(removeFromParent?: boolean): void;

    target?: Object3D

    // region inherited type fixes
    // re-declaring from IObject3D because: https://github.com/microsoft/TypeScript/issues/16936

    traverse(callback: (object: IObject3D) => void): void
    traverseVisible(callback: (object: IObject3D) => void): void
    traverseAncestors(callback: (object: IObject3D) => void): void
    getObjectById<T extends IObject3D = IObject3D>(id: number): T | undefined
    getObjectByName<T extends IObject3D = IObject3D>(name: string): T | undefined
    getObjectByProperty<T extends IObject3D = IObject3D>(name: string, value: string): T | undefined
    copy(source: this, recursive?: boolean, distanceFromTarget?: number, worldSpace?: boolean, ...args: any[]): this
    clone(recursive?: boolean): this
    add(...object: IObject3D[]): this
    remove(...object: IObject3D[]): this
    parent: IObject3D | null
    children: IObject3D[]

    // endregion
}

export type ILightEventTypes = IObject3DEventTypes | 'lightUpdate'// | string
export type ILightEvent = Omit<IObject3DEvent, 'type'> & {
    type: ILightEventTypes
    light?: ILight | null
    // change?: string
}
