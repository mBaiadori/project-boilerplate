import type { TreeNode } from "../../../types";
import type { InlineCreatingState } from "../types";

export type FlatItemType =
  | "file"
  | "directory"
  | "empty-folder"
  | "inline-create";

export interface FlatTreeItem {
  id: string;
  type: FlatItemType;
  node: TreeNode;
  depth: number;
  isExpanded?: boolean;
  hasChildren?: boolean;
  parentPath?: string;
}

/**
 * Achata hierarquia de TreeNode[] em uma lista unidimensional de itens visíveis
 * de forma ultrarrápida (O(N) onde N é apenas a contagem de nós visíveis/expandidos).
 */
export function flattenTree(
  nodes: TreeNode[],
  expandedFolders: Record<string, boolean>,
  inlineCreating: InlineCreatingState | null,
  depth = 0,
  result: FlatTreeItem[] = [],
): FlatTreeItem[] {
  // Criação inline na raiz do repositório
  if (depth === 0 && inlineCreating && inlineCreating.parentPath === "") {
    result.push({
      id: "__inline_create_root__",
      type: "inline-create",
      node: {
        name: "",
        path: "",
        type: inlineCreating.isFolder ? "directory" : "file",
      },
      depth: 0,
      parentPath: "",
    });
  }

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const isDir = node.type === "directory";
    const isExpanded = isDir && Boolean(expandedFolders[node.path]);
    const hasChildren =
      isDir && Boolean(node.children && node.children.length > 0);

    result.push({
      id: node.path,
      type: isDir ? "directory" : "file",
      node,
      depth,
      isExpanded,
      hasChildren,
    });

    if (isDir && isExpanded) {
      // Linha inline para criação nesta pasta
      if (inlineCreating && inlineCreating.parentPath === node.path) {
        result.push({
          id: `__inline_create_${node.path}__`,
          type: "inline-create",
          node: {
            name: "",
            path: `${node.path}/__new__`,
            type: inlineCreating.isFolder ? "directory" : "file",
          },
          depth: depth + 1,
          parentPath: node.path,
        });
      }

      if (node.children && node.children.length > 0) {
        flattenTree(
          node.children,
          expandedFolders,
          inlineCreating,
          depth + 1,
          result,
        );
      } else if (!inlineCreating || inlineCreating.parentPath !== node.path) {
        result.push({
          id: `__empty_${node.path}__`,
          type: "empty-folder",
          node: {
            name: "(pasta vazia)",
            path: `${node.path}/__empty__`,
            type: "file",
          },
          depth: depth + 1,
        });
      }
    }
  }

  return result;
}
