/* ---------------------------------------------------------------------------
   Drag to reorder the My apps row — loaded only when the person taps Edit
   (a dynamic import in Home), so an ordinary Home open never downloads it.

   Pointer events, no library. The dragged tile is marked, never moved or
   scaled (Aurora canon: a glass box is not translated or scaled — the tile
   under the pointer trades places with it instead, and React moves the DOM
   node, keyed by app id, so pointer capture survives the swap). A press that
   travels less than 6 px is a tap and is left alone for the tile's own
   buttons.
   --------------------------------------------------------------------------- */

const TILE = "[data-pin-id]";
const THRESHOLD_PX = 6;

export function attachReorder(grid: HTMLElement, move: (fromId: string, toId: string) => void): () => void {
  let drag: { id: string; pointerId: number; x: number; y: number; active: boolean; tile: HTMLElement } | null = null;

  const onDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement | null;
    if (!target || target.closest("button")) return;
    const tile = target.closest<HTMLElement>(TILE);
    if (!tile || !grid.contains(tile)) return;
    drag = { id: tile.dataset.pinId ?? "", pointerId: e.pointerId, x: e.clientX, y: e.clientY, active: false, tile };
    try { tile.setPointerCapture(e.pointerId); } catch { /* old engines */ }
  };

  const onMove = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    if (!drag.active) {
      if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < THRESHOLD_PX) return;
      drag.active = true;
      drag.tile.dataset.dragging = "1";
      grid.dataset.reordering = "1";
    }
    e.preventDefault();
    const under = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>(TILE);
    const overId = under && grid.contains(under) ? under.dataset.pinId : undefined;
    if (overId && overId !== drag.id) move(drag.id, overId);
  };

  const end = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    try { drag.tile.releasePointerCapture(e.pointerId); } catch { /* already released */ }
    delete drag.tile.dataset.dragging;
    delete grid.dataset.reordering;
    drag = null;
  };

  grid.addEventListener("pointerdown", onDown);
  grid.addEventListener("pointermove", onMove);
  grid.addEventListener("pointerup", end);
  grid.addEventListener("pointercancel", end);
  return () => {
    grid.removeEventListener("pointerdown", onDown);
    grid.removeEventListener("pointermove", onMove);
    grid.removeEventListener("pointerup", end);
    grid.removeEventListener("pointercancel", end);
  };
}
