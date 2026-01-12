<?php

$default_profile = [
  'title' => "Capitaine d'arene",
  'rating' => 2142,
  'motto' => "Chaque coup ecrit l'histoire.",
  'location' => 'Paris, FR',
];

$default_games = [
  [
    'id' => 'G-1042',
    'opponent' => 'M. Zhou',
    'result' => 'win',
    'opening' => 'Defense sicilienne',
    'date' => '24 Jan',
    'moves' => 38,
    'accuracy' => 91,
  ],
  [
    'id' => 'G-1041',
    'opponent' => 'L. Martinez',
    'result' => 'draw',
    'opening' => 'Gambit dame',
    'date' => '23 Jan',
    'moves' => 52,
    'accuracy' => 87,
  ],
  [
    'id' => 'G-1038',
    'opponent' => 'H. Nordin',
    'result' => 'loss',
    'opening' => 'Caro-Kann',
    'date' => '21 Jan',
    'moves' => 44,
    'accuracy' => 82,
  ],
  [
    'id' => 'G-1034',
    'opponent' => 'I. Patel',
    'result' => 'win',
    'opening' => 'Ruy Lopez',
    'date' => '18 Jan',
    'moves' => 33,
    'accuracy' => 93,
  ],
];

$default_goals = [
  ['label' => 'Conversion en finale', 'progress' => 72],
  ['label' => 'Vision tactique', 'progress' => 65],
  ["label" => "Preparation d'ouverture", 'progress' => 58],
];

$default_matches = [
  [
    'id' => 'M-1042',
    'mode' => 'IA',
    'opponent' => 'IA Atlas',
    'status' => 'en_cours',
    'createdAt' => '09 Jan 19:10',
    'lastMove' => 'Cg1-f3',
    'timeControl' => '10+0',
    'side' => 'Blancs',
    'difficulty' => 'intermediaire',
  ],
  [
    'id' => 'M-1038',
    'mode' => 'JcJ',
    'opponent' => 'L. Vernet',
    'status' => 'planifie',
    'createdAt' => '09 Jan 21:00',
    'lastMove' => '-',
    'timeControl' => '5+0',
    'side' => 'Noirs',
  ],
  [
    'id' => 'M-1029',
    'mode' => 'IA',
    'opponent' => 'IA Nova',
    'status' => 'termine',
    'createdAt' => '07 Jan 18:35',
    'lastMove' => 'Dd1-e2',
    'timeControl' => '15+10',
    'side' => 'Blancs',
    'difficulty' => 'difficile',
  ],
];
