/**
 * Guard contra crash de React causado por mutação externa do DOM
 * (ex.: Google Translate, extensões do navegador) que produz:
 *   NotFoundError: Failed to execute 'removeChild' on 'Node':
 *   The node to be removed is not a child of this node.
 *
 * Patches conservadores: só interceptam o caso em que o nó já não
 * pertence mais ao pai esperado, devolvendo o nó silenciosamente
 * em vez de jogar a exceção que desmonta a árvore inteira.
 * Referência: https://github.com/facebook/react/issues/11538
 */
export function installDomSafeguards() {
  if (typeof Node === 'undefined' || !Node.prototype) return;
  if ((window as any).__domSafeguardsInstalled) return;
  (window as any).__domSafeguardsInstalled = true;

  const originalRemoveChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function <T extends Node>(child: T): T {
    if (child.parentNode !== this) {
      if (typeof console !== 'undefined') {
        console.warn('[domSafeguards] removeChild ignorado: nó já não pertence ao pai (provável extensão/tradutor).');
      }
      return child;
    }
    return originalRemoveChild.call(this, child) as T;
  } as typeof Node.prototype.removeChild;

  const originalInsertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function <T extends Node>(newNode: T, referenceNode: Node | null): T {
    if (referenceNode && referenceNode.parentNode !== this) {
      if (typeof console !== 'undefined') {
        console.warn('[domSafeguards] insertBefore ignorado: ref não pertence ao pai (provável extensão/tradutor).');
      }
      return newNode;
    }
    return originalInsertBefore.call(this, newNode, referenceNode) as T;
  } as typeof Node.prototype.insertBefore;
}