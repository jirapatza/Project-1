export function canvasPoint(clientX, clientY, rect, width, height) {
  if (!(rect.width > 0 && rect.height > 0)) throw new Error('invalid_canvas_bounds');
  return {x:(clientX-rect.left)*width/rect.width,y:(clientY-rect.top)*height/rect.height};
}
export function hitBox(boxes, point) {
  return [...boxes].reverse().find(b=>point.x>=b.x && point.x<=b.x+b.width && point.y>=b.y && point.y<=b.y+b.height);
}
export function movedBox(box, dx, dy, width, height) {
  return {...box,x:Math.max(0,Math.min(width-box.width,box.x+dx)),y:Math.max(0,Math.min(height-box.height,box.y+dy))};
}
