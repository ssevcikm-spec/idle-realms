(function () {
  const G = window.Game;

  G.EXPEDITIONS = {
    lost_caravan: {
      id: 'lost_caravan', name: 'Ztracená karavana', icon: '🐎',
      desc: 'Najdi ztracenou kupeckou karavanu v horách.',
      minDays: 2, maxDays: 4, difficulty: 2,
      rewardPool: [
        { material: 'coin', min: 40, max: 120, chance: 1.00 },
        { material: 'cloth', min: 3, max: 6, chance: 0.70 },
        { material: 'iron_ingot', min: 1, max: 3, chance: 0.50 },
        { material: 'jewel', min: 1, max: 2, chance: 0.30 }
      ],
      xpReward: 80, renownReward: 5,
      failureText: 'Karavana byla dávno pryč. Vrátili jste se s prázdnou.',
      successText: 'Našli jste karavanu ukrytou v rokli!'
    },
    ancient_ruins: {
      id: 'ancient_ruins', name: 'Starobylé zříceniny', icon: '🏛️',
      desc: 'Prozkoumej zříceniny dávné civilizace.',
      minDays: 3, maxDays: 6, difficulty: 3,
      rewardPool: [
        { material: 'coin', min: 80, max: 200, chance: 1.00 },
        { material: 'crystal', min: 2, max: 5, chance: 0.70 },
        { material: 'jewel', min: 2, max: 4, chance: 0.50 },
        { material: 'map_fragment', min: 1, max: 2, chance: 0.40 }
      ],
      xpReward: 150, renownReward: 10,
      failureText: 'Zříceniny byly prázdné. Jen prach a pavučiny.',
      successText: 'Našli jste skrytou komoru plnou pokladů!'
    },
    dragon_hunt: {
      id: 'dragon_hunt', name: 'Lov na draka', icon: '🐉',
      desc: 'Vypátrej a zabij draka ohrožujícího kraj.',
      minDays: 5, maxDays: 8, difficulty: 5,
      rewardPool: [
        { material: 'coin', min: 200, max: 500, chance: 1.00 },
        { material: 'dragon_scale', min: 3, max: 6, chance: 1.00 },
        { material: 'crystal', min: 4, max: 8, chance: 0.80 },
        { material: 'jewel', min: 3, max: 6, chance: 0.60 }
      ],
      xpReward: 400, renownReward: 30,
      failureText: 'Drak byl příliš silný. Sotva jste utekli.',
      successText: 'Drak padl! Jeho poklad je váš.'
    },
    distant_trade: {
      id: 'distant_trade', name: 'Daleká výprava', icon: '⛵',
      desc: 'Vydej se do vzdálené země za vzácným zbožím.',
      minDays: 4, maxDays: 7, difficulty: 1,
      rewardPool: [
        { material: 'coin', min: 100, max: 250, chance: 1.00 },
        { material: 'potion', min: 2, max: 5, chance: 0.60 },
        { material: 'cloth', min: 4, max: 8, chance: 0.70 }
      ],
      xpReward: 100, renownReward: 8,
      failureText: 'Obchod se nevyvedl. Vrátili jste se s prázdnou.',
      successText: 'Přivezli jste vzácné zboží!'
    },
    ice_journey: {
      id: 'ice_journey', name: 'Cesta za led', icon: '🧊',
      desc: 'Zamíříš na sever do zmrzlých plání.',
      minDays: 5, maxDays: 9, difficulty: 4,
      rewardPool: [
        { material: 'coin', min: 150, max: 350, chance: 1.00 },
        { material: 'crystal', min: 3, max: 7, chance: 0.80 },
        { material: 'jewel', min: 2, max: 5, chance: 0.60 }
      ],
      xpReward: 250, renownReward: 20,
      failureText: 'Mráz a vánice vás zahnaly zpět.',
      successText: 'Přinesli jste vzácné krystaly z ledu!'
    }
  };

  G.EXPEDITION_MIN_PARTY = 2;
  G.EXPEDITION_MAX_PARTY = 6;
})();
