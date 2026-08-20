// Compatibility helpers for the tiny procedural texture builder.
// Phaser Graphics has no built-in diamond primitive, so define one using paths.
(() => {
  const Graphics = window.Phaser?.GameObjects?.Graphics;
  if (!Graphics) return;
  const proto = Graphics.prototype;

  if (!proto.fillDiamond) {
    proto.fillDiamond = function fillDiamond(cx, cy, radius) {
      this.beginPath();
      this.moveTo(cx, cy - radius);
      this.lineTo(cx + radius, cy);
      this.lineTo(cx, cy + radius);
      this.lineTo(cx - radius, cy);
      this.closePath();
      this.fillPath();
      return this;
    };
  }

  if (!proto.strokeDiamond) {
    proto.strokeDiamond = function strokeDiamond(cx, cy, radius) {
      this.beginPath();
      this.moveTo(cx, cy - radius);
      this.lineTo(cx + radius, cy);
      this.lineTo(cx, cy + radius);
      this.lineTo(cx - radius, cy);
      this.closePath();
      this.strokePath();
      return this;
    };
  }
})();
