# Proposed Playground Design

This design is supposed to be a folder with scripts that become increasingly complex. The idea is that, every consequetive script contains an extension of the code in the first, ensuring that, the data is periodically fetched/lazily loaded.


Given some input paramater : location
1. Script 1 loads the terrain map, and allows one to explore say the height map, water map, etc.. any geographic maps
2. Script 2 loads the weather map,and allows one to explore specific maps like pressure, wind, temperature, humidity etc 
3. Script 3 loads the vegetation map, that is, shows the density and possibly height of vegetation, and specific items like transpiration rate, photosynthesis rate, 
4.  Script 4 loads the surface map, as in, the surface material, showing the places that have asphalt,cobblestones, unpaved roads, paths and items like pipes,telephone cables, internet cables etc
5. Script 5 loads traffic and specific maps showing air quality,exhaust trails, tunnels/chokepoints
6. Script 6 human activity map : shows pedestrian density, market activity, rate of density change to infer activity 
7. Script loads the glb, and has the option to include any of the previous items into this last script 