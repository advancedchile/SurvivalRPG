const fs = require('fs');
const path = require('path');

const appFile = path.join(__dirname, 'src', 'App.tsx');
let content = fs.readFileSync(appFile, 'utf8');

// Replacements

// 1. Imports
const imports = `import { Inventory } from './components/ui/Inventory';
import { Hotbar } from './components/ui/Hotbar';
import { CraftingMenu } from './components/ui/CraftingMenu';
import { Notifications } from './components/ui/Notifications';
import { Minimap } from './components/ui/Minimap';
`;

content = content.replace("import { GameMap } from './components/GameMap';", "import { GameMap } from './components/GameMap';\n" + imports);

// 2. Notifications
const notifStart = '{/* Notification */}';
const notifEnd = '</div>\n        </div>\n\n        {/* Minimap (Top Right) */}';
const notifStartIndex = content.indexOf(notifStart);
const notifEndIndex = content.indexOf(notifEnd);
if (notifStartIndex !== -1 && notifEndIndex !== -1) {
  content = content.substring(0, notifStartIndex) + 
            `<Notifications notifications={notifications} removeNotification={removeNotification} />` + 
            content.substring(notifEndIndex);
}

// 3. Minimap
const minimapStart = '{/* Minimap (Top Right) */}';
const minimapEnd = '{/* Status Prompt */}';
const minimapStartIndex = content.indexOf(minimapStart);
const minimapEndIndex = content.indexOf(minimapEnd);
if (minimapStartIndex !== -1 && minimapEndIndex !== -1) {
  content = content.substring(0, minimapStartIndex) +
            `<Minimap isMapOpen={isMapOpen} setIsMapOpen={setIsMapOpen} player={player} resources={resources} getTile={getTile} />\n\n        ` +
            content.substring(minimapEndIndex);
}

// 4. Large Map Overlay
const largeMapStart = '{/* Large Map Overlay */}';
const largeMapEnd = '    </div>\n  );\n}';
const largeMapStartIndex = content.indexOf(largeMapStart);
const largeMapEndIndex = content.indexOf(largeMapEnd);
if (largeMapStartIndex !== -1 && largeMapEndIndex !== -1) {
  content = content.substring(0, largeMapStartIndex) + content.substring(largeMapEndIndex);
}

// 5. Hotbar
const hotbarStart = '{/* Bottom Interface Container */}';
const hotbarEnd = '<AnimatePresence>\n        {isInventoryOpen && (';
const hotbarStartIndex = content.indexOf(hotbarStart);
const hotbarEndIndex = content.indexOf(hotbarEnd);
if (hotbarStartIndex !== -1 && hotbarEndIndex !== -1) {
  content = content.substring(0, hotbarStartIndex) +
    `<Hotbar 
        player={player} 
        setPlayer={setPlayer} 
        isInventoryOpen={isInventoryOpen} 
        setIsInventoryOpen={setIsInventoryOpen} 
        isCraftingOpen={isCraftingOpen} 
        setIsCraftingOpen={setIsCraftingOpen} 
        setIsHoveringHotbarWindow={setIsHoveringHotbarWindow} 
        hoveredHotbarIndex={hoveredHotbarIndex} 
        setHoveredHotbarIndex={setHoveredHotbarIndex} 
        draggingItem={draggingItem} 
        setDraggingItem={setDraggingItem} 
        moveItem={moveItem} 
        axeImage={axeImage} 
        pickaxeImage={pickaxeImage} 
      />\n\n      ` + content.substring(hotbarEndIndex);
}

// 6. Inventory & Crafting
const invCraftStart = '<AnimatePresence>\n        {isInventoryOpen && (';
const invCraftEnd = '{/* Intro Animation *) */}';
const invCraftStartIndex = content.indexOf(invCraftStart);
const invCraftEndIndex = content.indexOf(invCraftEnd);
if (invCraftStartIndex !== -1 && invCraftEndIndex !== -1) {
  content = content.substring(0, invCraftStartIndex) +
    `<AnimatePresence>
        <Inventory 
          isInventoryOpen={isInventoryOpen} 
          setIsInventoryOpen={setIsInventoryOpen} 
          setIsHoveringInventoryWindow={setIsHoveringInventoryWindow} 
          player={player} 
          hoveredInvIndex={hoveredInvIndex} 
          setHoveredInvIndex={setHoveredInvIndex} 
          draggingItem={draggingItem} 
          setDraggingItem={setDraggingItem} 
          moveItem={moveItem} 
          axeImage={axeImage} 
          pickaxeImage={pickaxeImage} 
        />
        <CraftingMenu 
          isCraftingOpen={isCraftingOpen} 
          setIsCraftingOpen={setIsCraftingOpen} 
          unlockedRecipeNotifications={unlockedRecipeNotifications} 
          recipes={recipes} 
          player={player} 
          craft={craft} 
        />
      </AnimatePresence>\n\n      ` + content.substring(invCraftEndIndex);
}

fs.writeFileSync(appFile, content);
console.log("Refactor 3 complete");
