# Gen 1 Special Stat & Mechanics Deviations Audit

Generation 1 featured a single, unified `Special` stat used for both Special Attack power and Special Defense resistance. In Generation 2, this stat was split into `Special Attack` and `Special Defense`. In modern PokeAPI data, base stats represent the modern split stats.

The pipeline restores the authentic Gen 1 base Special stat for all 151 Pokémon. Below is the full audit of all Pokémon where the Gen 1 Special stat deviates from modern base Special Attack:

| Dex # | Pokémon | Gen 1 Special | Modern Sp. Atk | Modern Sp. Def | Note |
| :---: | :--- | :---: | :---: | :---: | :--- |
| #004 | Charmander | **50** | 60 | 50 | Gen 1 Special unified |
| #005 | Charmeleon | **65** | 80 | 65 | Gen 1 Special unified |
| #006 | Charizard | **85** | 109 | 85 | Gen 1 Special unified |
| #012 | Butterfree | **80** | 90 | 80 | Gen 1 Special unified |
| #027 | Sandshrew | **30** | 20 | 30 | Gen 1 Special unified |
| #028 | Sandslash | **55** | 45 | 55 | Gen 1 Special unified |
| #036 | Clefable | **85** | 95 | 90 | Gen 1 Special unified |
| #037 | Vulpix | **65** | 50 | 65 | Gen 1 Special unified |
| #038 | Ninetales | **100** | 81 | 100 | Gen 1 Special unified |
| #039 | Jigglypuff | **25** | 45 | 25 | Gen 1 Special unified |
| #040 | Wigglytuff | **50** | 85 | 50 | Gen 1 Special unified |
| #041 | Zubat | **40** | 30 | 40 | Gen 1 Special unified |
| #042 | Golbat | **75** | 65 | 75 | Gen 1 Special unified |
| #045 | Vileplume | **100** | 110 | 90 | Gen 1 Special unified |
| #046 | Paras | **55** | 45 | 55 | Gen 1 Special unified |
| #047 | Parasect | **80** | 60 | 80 | Gen 1 Special unified |
| #050 | Diglett | **45** | 35 | 45 | Gen 1 Special unified |
| #051 | Dugtrio | **70** | 50 | 70 | Gen 1 Special unified |
| #054 | Psyduck | **50** | 65 | 50 | Gen 1 Special unified |
| #055 | Golduck | **80** | 95 | 80 | Gen 1 Special unified |
| #058 | Growlithe | **50** | 70 | 50 | Gen 1 Special unified |
| #059 | Arcanine | **80** | 100 | 80 | Gen 1 Special unified |
| #072 | Tentacool | **100** | 50 | 100 | Gen 1 Special unified |
| #073 | Tentacruel | **120** | 80 | 120 | Gen 1 Special unified |
| #080 | Slowbro | **80** | 100 | 80 | Gen 1 Special unified |
| #086 | Seel | **70** | 45 | 70 | Gen 1 Special unified |
| #087 | Dewgong | **95** | 70 | 95 | Gen 1 Special unified |
| #096 | Drowzee | **90** | 43 | 90 | Gen 1 Special unified |
| #097 | Hypno | **115** | 73 | 115 | Gen 1 Special unified |
| #113 | Chansey | **105** | 35 | 105 | Gen 1 Special unified |
| #124 | Jynx | **95** | 115 | 95 | Gen 1 Special unified |
| #125 | Electabuzz | **85** | 95 | 85 | Gen 1 Special unified |
| #126 | Magmar | **85** | 100 | 85 | Gen 1 Special unified |
| #128 | Tauros | **70** | 40 | 70 | Gen 1 Special unified |
| #130 | Gyarados | **100** | 60 | 100 | Gen 1 Special unified |
| #131 | Lapras | **95** | 85 | 95 | Gen 1 Special unified |
| #136 | Flareon | **110** | 95 | 110 | Gen 1 Special unified |
| #137 | Porygon | **75** | 85 | 75 | Gen 1 Special unified |
| #140 | Kabuto | **45** | 55 | 45 | Gen 1 Special unified |
| #141 | Kabutops | **70** | 65 | 70 | Gen 1 Special unified |
| #144 | Articuno | **125** | 95 | 125 | Gen 1 Special unified |
