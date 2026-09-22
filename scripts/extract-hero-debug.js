const sharp = require("sharp");
const src = "public/images/hero/approved-scene.png";

(async () => {
  await sharp(src).extract({ left: 0, top: 56, width: 1230, height: 604 }).png().toFile("public/images/hero/_debug-no-chrome.png");
  await sharp(src).extract({ left: 250, top: 70, width: 280, height: 380 }).png().toFile("public/images/hero/_debug-truck.png");
  await sharp(src).extract({ left: 700, top: 180, width: 280, height: 320 }).png().toFile("public/images/hero/_debug-car.png");
  await sharp(src).extract({ left: 300, top: 400, width: 630, height: 240 }).png().toFile("public/images/hero/_debug-road.png");
  await sharp(src).extract({ left: 280, top: 70, width: 670, height: 520 }).png().toFile("public/images/hero/_debug-center.png");
  console.log("debug crops written");
})();
