export type {
  ContainerDirective,
  Directive,
  LeafDirective,
  TextDirective
} from './lib/index.js'

export {directiveFromMarkdown, directiveToMarkdown} from './lib/index.js'

// Add custom data tracked to turn markdown into a tree.
declare module 'mdast-util-from-markdown' {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
  interface CompileData {
    /**
     * Attributes for current directive.
     */
    directiveAttributes?: Array<[string, string]> | undefined
  }
}

declare module 'mdast-util-to-markdown' {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
  interface ConstructNameMap {
    /**
     * Whole container directive.
     *
     * ```markdown
     * > | :::a
     *     ^^^^
     * > | :::
     *     ^^^
     * ```
     */
    containerDirective: 'containerDirective'

    /**
     * Label of a container directive.
     *
     * ```markdown
     * > | :::a[b]
     *         ^^^
     *   | :::
     * ```
     */
    containerDirectiveLabel: 'containerDirectiveLabel'

    /**
     * Whole leaf directive.
     *
     * ```markdown
     * > | ::a
     *     ^^^
     * ```
     */
    leafDirective: 'leafDirective'

    /**
     * Label of a leaf directive.
     *
     * ```markdown
     * > | ::a[b]
     *        ^^^
     * ```
     */
    leafDirectiveLabel: 'leafDirectiveLabel'

    /**
     * Whole text directive.
     *
     * ```markdown
     * > | :a
     *     ^^
     * ```
     */
    textDirective: 'textDirective'

    /**
     * Label of a text directive.
     *
     * ```markdown
     * > | :a[b]
     *       ^^^
     * ```
     */
    textDirectiveLabel: 'textDirectiveLabel'
  }
}
