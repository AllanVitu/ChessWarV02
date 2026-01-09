import { sql } from './db'
import { defaultGames, defaultGoals, defaultMatches, defaultProfile } from './defaults'

export const ensureDashboardSeed = async (
  userId: string,
  email: string,
  displayName: string,
  lastSeen: string,
) => {
  const profiles = await sql<{ user_id: string }[]>`
    SELECT user_id
    FROM profiles
    WHERE user_id = ${userId}
    LIMIT 1
  `

  if (!profiles.length) {
    await sql`
      INSERT INTO profiles
        (user_id, name, title, rating, motto, location, last_seen, email)
      VALUES
        (${userId}, ${displayName}, ${defaultProfile.title}, ${defaultProfile.rating},
         ${defaultProfile.motto}, ${defaultProfile.location}, ${lastSeen}, ${email})
    `
  }

  const gamesCount = await sql<{ count: string }[]>`
    SELECT COUNT(*)::text AS count
    FROM games
    WHERE user_id = ${userId}
  `

  if (!Number(gamesCount[0]?.count)) {
    for (const game of defaultGames) {
      await sql`
        INSERT INTO games
          (id, user_id, opponent, result, opening, date, moves, accuracy)
        VALUES
          (${game.id}, ${userId}, ${game.opponent}, ${game.result}, ${game.opening},
           ${game.date}, ${game.moves}, ${game.accuracy})
      `
    }
  }

  const goalsCount = await sql<{ count: string }[]>`
    SELECT COUNT(*)::text AS count
    FROM goals
    WHERE user_id = ${userId}
  `

  if (!Number(goalsCount[0]?.count)) {
    for (const goal of defaultGoals) {
      await sql`
        INSERT INTO goals
          (user_id, label, progress)
        VALUES
          (${userId}, ${goal.label}, ${goal.progress})
      `
    }
  }
}

export const ensureMatchesSeed = async (userId: string) => {
  const matchesCount = await sql<{ count: string }[]>`
    SELECT COUNT(*)::text AS count
    FROM matches
    WHERE user_id = ${userId}
  `

  if (!Number(matchesCount[0]?.count)) {
    for (const match of defaultMatches) {
      await sql`
        INSERT INTO matches
          (id, user_id, mode, opponent, status, created_at, last_move, time_control, side, difficulty)
        VALUES
          (${match.id}, ${userId}, ${match.mode}, ${match.opponent}, ${match.status},
           ${match.createdAt}, ${match.lastMove}, ${match.timeControl}, ${match.side},
           ${match.difficulty ?? null})
      `
    }
  }
}
