export type CanIUseServiceResolver = () => object | null | undefined;
export interface CanIUseOptions {
    ready?: Promise<void>;
    isAllowed?: (functionName: string) => boolean;
}
export interface AttachCanIUseOptions extends CanIUseOptions {
    resolveService?: CanIUseServiceResolver;
}
export declare function createCanIUse(resolveService: CanIUseServiceResolver, options?: CanIUseOptions): (functionName: string) => Promise<boolean>;
export declare function attachCanIUse(service: object, options?: AttachCanIUseOptions): (functionName: string) => Promise<boolean>;
//# sourceMappingURL=canIUse.d.ts.map