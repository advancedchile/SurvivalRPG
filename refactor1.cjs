const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'src', 'App.tsx');
let content = fs.readFileSync(file, 'utf8');

// The block starts with:
//   const [customAssets, setCustomAssets] = useState<Record<ResourceType, HTMLImageElement[]>>({
// and ends with the second useEffect's closing bracket
//   }, []);

const startMarker = '  const [customAssets, setCustomAssets]';
const endMarker = '  }, []);';

const startIndex = content.indexOf(startMarker);
let endIndex = content.indexOf(endMarker, startIndex);
endIndex = content.indexOf(endMarker, endIndex + 1); // Get the second useEffect's end

if (startIndex !== -1 && endIndex !== -1) {
  const replacement = `  const { customAssets, choppedWoodAssets, snowyTreeAssets, stickAssets, axeImage, pickaxeImage, grassTextures, dirtTextures } = useAssets();`;
  
  // also add import at the top
  const importStatement = `import { useAssets } from './hooks/useAssets';\n`;
  content = importStatement + content;

  content = content.substring(0, startIndex) + replacement + content.substring(endIndex + endMarker.length);
  fs.writeFileSync(file, content);
  console.log('Refactor 1 complete');
} else {
  console.log('Markers not found');
}
