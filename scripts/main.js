// Object.defineProperty(TokenDocument.prototype, "sort" , {
//   get: function(){
//     if(!(this instanceof TokenDocument)) {
//       return 0;
//     }
//     const zIndexOverride = this["token-z"]?.zIndexOverride;
//     if(typeof zIndexOverride === "number") {
//       return zIndexOverride;
//     }
//     const flag = this.flags["token-z"]?.zIndex ?? 0;
//     const controlled = this._object?.controlled ? 1 : 0;
//     const defeated = this.actor?.effects?.find(e => e.getFlag("core", "statusId") === CONFIG.specialStatusEffects.DEFEATED) ? -1000 : 0;
//     return 2 - this.width - this.height + controlled + flag + defeated;
//   },
//   set: function (value) {}
// })

Hooks.on("controlToken", (token, controlled) => {
  if(controlled) {
    // token.mesh.zIndex += 1;
    if(game.settings.get("token-z", "enablesync")) {
      let tokenId = token.id;
      let sceneId = game.scenes.viewed.id;
      let socketData = {
        tokenId:tokenId,
        sceneIdd:sceneId,
        sort:token.document.sort,
        elevation: getElevationPlaceableObject(token) // token.document.elevation
      }
      game.socket.emit("module.token-z", socketData);
    }
  }

})

Hooks.on("renderTokenConfig", (app, html, data) => {
  let zIndex = app.token.getFlag("token-z", "zIndex") || 0;

  let newHtml = `
  <div class="form-group">
              <label>${game.i18n.localize("token-z.tokenconfig.zindex")}</label>
              <input type="number" name="flags.token-z.zIndex" placeholder="units" value="${zIndex}">
          </div>
  `;
  html.find('input[name="rotation"]').closest(".form-group").after(newHtml);
  app.setPosition({height: "auto"})
});

//Pushback

Hooks.on("init", () => {

  game.settings.register("token-z", "enablesync", {
    name: game.i18n.localize("token-z.settings.enablesync.name"),
    hint: game.i18n.localize("token-z.settings.enablesync.hint"),
    scope: "world",
    config: true,
    default: false,
    type: Boolean,
  });

});

Hooks.once("setup", () => {
  game.keybindings.register("token-z", "send-to-back-key", {
    name: "token-z.send-to-back.name",
    hint: "token-z.send-to-back.hint",
    editable: [{ key: 'KeyZ' }],
    restricted: false,
    onDown: pushTokenBack
  });

  function pushTokenBack(event) {
    const hoveredToken = canvas.tokens.hover;
    if (hoveredToken && !event.repeat) {

      // const localStorage = (hoveredToken.document["token-z"] ??= {});
      // localStorage.zIndexOverride = Math.min(-2000, ...canvas.tokens.placeables.map(t => t.document.sort)) - 1;
      // hoveredToken.mesh.zIndex = localStorage.zIndexOverride;

      const tokenStack = findTokensWithinBoundaries(hoveredToken);
      if (!tokenStack || tokenStack.length <= 0) {
        return;
      }

      let position = 0;
      for (const x of canvas.tokens.placeables) {
         if (x.id === hoveredToken.id) {
          break;
         }
         position++;
      }
      if (position < canvas.tokens.placeables.length){
        // found the child, push it to element 0
        canvas.tokens.placeables.splice(position,1);
        canvas.tokens.placeables.unshift(hoveredToken);

        const hud = hoveredToken.layer.hud;
        if ( hud ) {
          hud.clear();
        }
        // Add or remove the Placeable Object from the currently controlled set
        tokenStack[tokenStack.length-1].control({releaseOthers: true});
        tokenStack[tokenStack.length-1].release();
        // for ( let o of tokenStack[tokenStack.length-1].layer.controlled ) {
        //   if ( o !== tokenStack[tokenStack.length-1] ) {
        //     o.release();
        //   }
        // }
        // // Trigger follow-up events and fire an on-control Hook
        // tokenStack[tokenStack.length-1].document.sort += 1;
        // tokenStack[tokenStack.length-1].refresh();
        // canvas.perception.update({
        //   initializeVision: true,
        //   forceUpdateFog: true,
        //   refreshLighting: true,
        //   refreshSounds: true,
        //   refreshTiles: true
        // }, true);
        // canvas.triggerPendingOperations();
      }
  
    }
  }
});

Hooks.once('ready', async function () {
  game.socket.on("module.token-z", (...args) => {
    let [socketData] = args;
    let tokenId = socketData.tokenId;
    let sceneId = socketData.sceneId;
    let elevation = socketData.elevation;
    let sort = socketData.sort;

    if (game.scenes.viewed.id == sceneId){
        canvas.tokens.placeables.forEach(token=>{
            if (token.id==tokenId){
                token.document.sort = sort;
            } else {
                if (token.document.elevation == elevation) {
                    if (sort == 1) {
                      token.document.sort = 0;
                    }
                }
            }
        })
    }
  });
});



function getElevationPlaceableObject(placeableObject) {
	let base = placeableObject;
	if (base.document) {
		base = base.document;
	}

  const isLevelsEnabled = game.modules("levels")?.active && typeof _levels !== "undefined";
  if(isLevelsEnabled) {
    const base_elevation = _levels?.advancedLOS && (placeableObject instanceof Token || placeableObject instanceof TokenDocument)
			? _levels.getTokenLOSheight(placeableObject)
			: base.flags["levels"]?.elevation ??
			  base.flags["levels"]?.rangeBottom ??
			  base.flags["wallHeight"]?.wallHeightBottom ??
        base.elevation ??
			  0;
    return base_elevation;
  } else {
    return base.elevation ?? 0;
  }
}

//- finds tokens with co-ordinates within the boundaries of the given token
//-array will be ordered from top to bottom. Top being index 0
function findTokensWithinBoundaries(hoveredToken) {
  let tokenStack = [];
	if (hoveredToken) {
		//@ts-ignore
		const tokensToCheck = [...canvas.tokens?.placeables].filter((token) => token.mesh.visible);
		tokenStack = tokensToCheck.filter(
			(t) =>
				t.x + t.w > hoveredToken.x &&
				t.y + t.h > hoveredToken.y &&
				t.x < hoveredToken.x + hoveredToken.w &&
				t.y < hoveredToken.y + hoveredToken.h &&
				t.id !== hoveredToken.id

			// position.x >= token.x &&
			// position.x < token.x + token.document.width * canvas.grid.size &&
			// position.y >= token.y &&
			// position.y < token.y + token.document.height * canvas.grid.size
		);
	}
	return tokenStack;
}