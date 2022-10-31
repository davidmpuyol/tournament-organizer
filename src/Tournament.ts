import * as randomString from 'randomized-string';
import { Match } from './Match.js';
import { Player } from './Player.js';
import * as Pairings from './Pairings.js';
import * as Tiebreakers from './Tiebreakers.js';

/**
 * Defines the properties that could be included in a tournament. Primarily used for loading tournaments and using tiebreakers. All definitions are found in class extensions.
 */
interface Structure {
    id: string;
    name: string;
    format: 'elimination'| 'swiss' | 'round robin';
    sorting: 'none' | 'ascending' | 'descending';
    consolation: boolean;
    playerLimit: number;
    pointsForWin: number;
    pointsForDraw: number;
    pointsForBye?: number;
    currentRound: number;
    startTime: Date;
    players: Array<Player>;
    matches: Array<Match>;
    status: 'registration' | 'active' | 'playoffs' | 'aborted' | 'finished';
    rounds?: number;
    playoffs?: 'none' | 'single elimination' | 'double elimination';
    bestOf?: number;
    cut?: {
        type: 'none' | 'rank' | 'points',
        limit: number
    };
    tiebreakers?: [
        'median buchholz' |
        'solkoff' |
        'sonneborn berger' |
        'cumulative' |
        'versus' |
        'game win percentage' |
        'opponent game win percentage' |
        'opponent match win percentage' |
        'opponent opponent match win percentage'
    ];
    double?: boolean;
}

/**
 * @internal
 */
type BasicTournamentProperties = {
    id: string,
    name: string,
    format: 'elimination'| 'swiss' | 'round robin',
    sorting?: 'none' | 'ascending' | 'descending',
    consolation?: boolean,
    playerLimit?: number,
    pointsForWin?: number,
    pointsForDraw?: number,
    tiebreakers?: [
        'median buchholz' |
        'solkoff' |
        'sonneborn berger' |
        'cumulative' |
        'versus' |
        'game win percentage' |
        'opponent game win percentage' |
        'opponent match win percentage' |
        'opponent opponent match win percentage'
    ]
}

/** Class representing a tournament. All tournaments that are created will be a subclass of this. */
class Tournament implements Structure {

    /** Unique ID of the tournament. */
    id: string;

    /**
     * Name of the tournament.
     * @default 'New Tournament'
    */
    name: string;

    /** 
     * Format for the first stage of the tournament.
     * @default 'single elimination'
    */
    format: 'elimination'| 'swiss' | 'round robin';

    /** 
     * If players are sorted by a seed value, and the direction in which to sort them. 
     * @default 'none'
    */
    sorting: 'none' | 'ascending' | 'descending';

    /** 
     * If there is a third place consolation match. Only used in elimination formats/playoffs. 
     * @default false
    */
    consolation: boolean;

    /** 
     * Maximum number of players allowed to register for the tournament. If equal to 0, then there is no maximum. 
     * @default 0
    */
    playerLimit: number;
    
    /** 
     * Number of points assigned to a match win. 
     * @default 1
    */
    pointsForWin: number;

    /** 
     * Number of points assigned to a drawn match. 
     * @default 0.5
    */
    pointsForDraw: number;

    /** 
     * Current round of the tournament.
     * @default 0
    */
    currentRound: number;

    /** Creation date and time of the tournament. */
    startTime: Date;

    /** 
     * Array of all players in the tournament.
     * @default []
    */
    players: Player[];

    /** 
     * Array of all matches in the tournament.
     * @default []
    */
    matches: Match[];

    /** The current status of the tournament. */
    status: 'registration' | 'active' | 'playoffs' | 'aborted' | 'finished';

    constructor(opt: {
        id: string,
        name: string,
        format: 'elimination'| 'swiss' | 'round robin',
        sorting?: 'none' | 'ascending' | 'descending',
        consolation?: boolean,
        playerLimit?: number,
        pointsForWin?: number,
        pointsForDraw?: number
    }) {
        
        // Default values
        let options = Object.assign({
            sorting: 'none',
            consolation: false,
            playerLimit: 0,
            pointsForWin: 1,
            pointsForDraw: 0.5,
            startTime: new Date(Date.now()),
            currentRound: 0,
            players: [],
            matches: [],
            status: 'registration'
        }, opt);
        
        this.id = options.id;
        this.name = options.name;
        this.format = options.format;
        this.sorting = options.sorting;
        this.consolation = options.consolation;
        this.playerLimit = options.playerLimit;
        this.pointsForWin = options.pointsForWin;
        this.pointsForDraw = options.pointsForDraw;
        this.startTime = options.startTime;
        this.currentRound = options.currentRound;
        this.players = [];
        this.matches = [];
        this.status = options.status;

        if(options.players){
            var _this = this;
            options.players.forEach(function(player){
                var newPlayer = new Player_js_1.Player(player);
                _this.players.push(newPlayer);
            })
        }

        if(options.matches){
            var _this = this;
            options.matches.forEach(function(match){
                var newMatch = new Match(match);
                _this.matches.push(newMatch);
            })
        }
    }

    /**
     * Get the current standings of the tournament.
     * @param active If only active players are included in standings (default is true).
     * @returns Sorted array of players
     */
    standings(active?: boolean) : Player[] {
        
        // Default value
        const activeOnly = arguments.length === 1 ? active : true;

        // Compute tiebreakers
        Tiebreakers.compute(this);

        // Get players to sort
        const playersToSort = activeOnly ? this.players.filter(player => player.active) : [...this.players];

        // Sort players
        return Tiebreakers.sort(playersToSort, this);
    }

    /**
     * Create a new player and add them to the tournament.
     * @param tournament The tournament for which the player is being added.
     * @param options User-defined options for a new player.
     * @returns The newly created player.
     * @internal
     */
    static newPlayer(tournament: Swiss | RoundRobin | Elimination, options: {
        alias: string,
        id: string,
        seed: number,
        initialByes: number
    }): Player {

        // Times when a player can not be added
        if (tournament.playerLimit > 0 && tournament.players.length === tournament.playerLimit) {
            throw `Player maximum of ${tournament.playerLimit} has been reached. Player can not be added.`
        }

        if (['Playoffs', 'Aborted', 'Finished'].some(str => str === tournament.status)) {
            throw `Current tournament status is ${tournament.status}. Player can not be added.`;
        }

        if (options.hasOwnProperty('id') && tournament.players.some(player => player.id === options.id)) {
            throw `A player with ID ${options.id} is already enrolled in the tournament. Duplicate player can not be added.`;
        }

        if (tournament.status !== 'registration' && tournament.format !== 'swiss') {
            throw `Players can not be added late to ${tournament.format} tournaments.`;
        }

        // No duplicate IDs
        while (tournament.players.some(player => player.id === options.id)) {
            options.id = randomString.generate({length: 10, charset: 'alphanumeric'});
        }

        // Create new player
        const newPlayer = new Player(options);
        tournament.players.push(newPlayer);

        return newPlayer;
    }

    /**
     * Record a result during an elimination tournament/playoff. Called by subclasses.
     * @param tournament The tournament for which the result is being reported.
     * @param matchID ID of the match being reported.
     * @param result Array containing player one's game wins and player two's game wins.
     * @internal
     */
    static eliminationResult(tournament: Swiss | RoundRobin | Elimination, matchID: string, result: [number, number]) : void {
        
        // Wins can not be equal, as elimination needs a winner
        if (result[0] === result[1]) {
            throw 'One player must win more games than the other during elimination.';
        }

        // Get the match
        const match = tournament.matches.find(m => m.id === matchID);
        if (match === undefined) {
            throw `No match found with the ID ${matchID}.`;
        }

        // Get the players
        const playerOne = tournament.players.find(player => player.id === match.playerOne);
        const playerTwo = tournament.players.find(player => player.id === match.playerTwo);

        // Reset match and pull players back
        let winnersMatch: Match;
        let losersMatch: Match;
        if (match.active === false) {
            let formerWinner: Player;
            let formerLoser: Player;
            if (match.result.playerOneWins > match.result.playerTwoWins) {
                formerWinner = playerOne;
                formerLoser = playerTwo;
            } else {
                formerWinner = playerTwo;
                formerLoser = playerOne;
            }
            formerWinner.active = true;
            formerLoser.active = true;
            winnersMatch = tournament.matches.find(m => m.id === match.winnersPath);
            if (winnersMatch.playerOne === formerWinner.id) {
                winnersMatch.playerOne = null;
            } else if (winnersMatch.playerTwo === formerWinner.id) {
                winnersMatch.playerTwo = null;
                winnersMatch.active = false;
            }
            if (match.losersPath !== null) {
                losersMatch = tournament.matches.find(m => m.id === match.losersPath);
                if (losersMatch.playerOne === formerLoser.id) {
                    losersMatch.playerOne = null;
                } else if (losersMatch.playerTwo === formerLoser.id) {
                    losersMatch.playerTwo = null;
                    losersMatch.active = false;
                }
            } else {
                formerLoser.active = true;
            }

            // Erase results if they've been reported already
            Tournament.eraseResult(tournament, match);
        }
        
        // Set result
        match.result.playerOneWins = result[0];
        playerOne.results.push({
            match: match.id,
            round: match.round,
            opponent: match.playerTwo,
            outcome: result[0] > result[1] ? 'win' : 'loss',
            matchPoints: result[0] > result[1] ? tournament.pointsForWin : 0,
            gamePoints: result[0] * tournament.pointsForWin,
            games: result.reduce((sum, points) => sum + points, 0)
        });
        const playerOneResult = playerOne.results[playerOne.results.length - 1];
        playerOne.matchCount++;
        playerOne.matchPoints += playerOneResult.matchPoints;
        playerOne.gameCount += playerOneResult.games;
        playerOne.gamePoints += playerOneResult.gamePoints;
        
        match.result.playerTwoWins = result[1];
        playerTwo.results.push({
            match: match.id,
            round: match.round,
            opponent: match.playerOne,
            outcome: result[1] > result[0] ? 'win' : 'loss',
            matchPoints: result[1] > result[0] ? tournament.pointsForWin : 0,
            gamePoints: result[1] * tournament.pointsForWin,
            games: result.reduce((sum, points) => sum + points, 0)
        });
        const playerTwoResult = playerTwo.results[playerTwo.results.length - 1];
        playerTwo.matchCount++;
        playerTwo.matchPoints += playerTwoResult.matchPoints;
        playerTwo.gameCount += playerTwoResult.games;
        playerTwo.gamePoints += playerTwoResult.gamePoints;
        match.active = false;

        // Move players to next matches (or end event)
        let winner: Player, loser: Player;
        if (result[0] > result[1]) {
            winner = playerOne;
            loser = playerTwo;
        } else {
            winner = playerTwo;
            loser = playerOne;
        }
        if (match.winnersPath === null) {
            tournament.status = 'finished';
            return;
        } else {
            if (winnersMatch === undefined) winnersMatch = tournament.matches.find(m => m.id === match.winnersPath);
            if (winnersMatch.playerOne === null) {
                winnersMatch.playerOne = winner.id;
            } else if (winnersMatch.playerTwo === null) {
                winnersMatch.playerTwo = winner.id;
                winnersMatch.active = true;
            }
        }
        if (match.losersPath === null) {
            loser.active = false;
        } else {
            if (losersMatch === undefined) losersMatch = tournament.matches.find(m => m.id === match.losersPath);
            if (losersMatch.playerOne === null) {
                losersMatch.playerOne = loser.id;
            } else if (losersMatch.playerTwo === null) {
                losersMatch.playerTwo = loser.id;
                losersMatch.active = true;
            }
        }
    }

    /**
     * Record a result during an swiss or round-robin tournament. Called by subclasses.
     * @param tournament The tournament for which the result is being reported.
     * @param matchID ID of the match being reported.
     * @param result Array containing player one's games won, player two's games won, and the number of games drawn.
     * @internal
     */
    static standardResult(tournament: Swiss | RoundRobin, matchID: string, result: [number, number, number]) : void {

        // Get the match
        const match = tournament.matches.find(m => m.id === matchID);
        if (match === undefined) {
            throw `No match found with the ID ${matchID}.`;
        }

        // Erase results if they've been reported already
        if (match.active === false) {
            Tournament.eraseResult(tournament, match);
        }

        // Get the players and result
        const playerOne = tournament.players.find(player => player.id === match.playerOne);
        const playerTwo = tournament.players.find(player => player.id === match.playerTwo);
        playerOne.active = true;
        playerTwo.active = true;

        // Set result
        match.result.playerOneWins = result[0];
        playerOne.results.push({
            match: match.id,
            round: match.round,
            opponent: match.playerTwo,
            outcome: result[0] > result[1] ? 'win' : result[1] > result[0] ? 'loss': 'draw',
            matchPoints: result[0] > result[1] ? tournament.pointsForWin : result[1] > result[0] ? 0 : tournament.pointsForDraw,
            gamePoints: result[0] * tournament.pointsForWin + result[2] * tournament.pointsForDraw,
            games: result.reduce((sum, points) => sum + points, 0)
        });
        const playerOneResult = playerOne.results[playerOne.results.length - 1];
        playerOne.matchCount++;
        playerOne.matchPoints += playerOneResult.matchPoints;
        playerOne.gameCount += playerOneResult.games;
        playerOne.gamePoints += playerOneResult.gamePoints;
        
        match.result.playerTwoWins = result[1];
        playerTwo.results.push({
            match: match.id,
            round: match.round,
            opponent: match.playerOne,
            outcome: result[1] > result[0] ? 'win' : result[0] > result[1] ?'loss': 'draw',
            matchPoints: result[1] > result[0] ? tournament.pointsForWin : result[0] > result[1] ? 0 : tournament.pointsForDraw,
            gamePoints: result[1] * tournament.pointsForWin + result[2] * tournament.pointsForDraw,
            games: result.reduce((sum, points) => sum + points, 0)
        });
        const playerTwoResult = playerTwo.results[playerTwo.results.length - 1];
        playerTwo.matchCount++;
        playerTwo.matchPoints += playerTwoResult.matchPoints;
        playerTwo.gameCount += playerTwoResult.games;
        playerTwo.gamePoints += playerTwoResult.gamePoints;
        match.result.draws = result[2];
        match.active = false;

        // Compute tiebreakers
        Tiebreakers.compute(tournament);
    }

    /**
     * Reset a result of a match.
     * @param tournament The tournament the match belongs to.
     * @param match The match being reset.
     * @internal
     */
    static eraseResult(tournament: Swiss | RoundRobin | Elimination, match: Match) : void {

        // The match needs to not be active
        if (match.active === true) {
            throw `Can only erase results from matches that have been reported.`;
        }

        // Can't erase results from byes or losses
        if (match.playerOne === null || match.playerTwo === null) {
            throw `Can't erase results from byes or assigned losses.`;
        }

        // Adjust the match status and result
        match.active = true;
        match.result = {
            playerOneWins: 0,
            playerTwoWins: 0,
            draws: 0
        };

        // Get the players
        const playerOne = tournament.players.find(player => player.id === match.playerOne);
        const playerTwo = tournament.players.find(player => player.id === match.playerTwo);

        // For each player, fix their scores
        const playerOneResult = playerOne.results.find(result => result.match === match.id);
        playerOne.matchCount--;
        playerOne.matchPoints -= playerOneResult.matchPoints;
        playerOne.gamePoints -= playerOneResult.gamePoints;
        playerOne.gameCount -= playerOneResult.games;
        playerOne.results.splice(playerOne.results.findIndex(res => res.match === playerOneResult.match), 1);

        const playerTwoResult = playerTwo.results.find(result => result.match === match.id);
        playerTwo.matchCount--;
        playerTwo.matchPoints -= playerTwoResult.matchPoints;
        playerTwo.gamePoints -= playerTwoResult.gamePoints;
        playerTwo.gameCount -= playerTwoResult.games;
        playerTwo.results.splice(playerTwo.results.findIndex(res => res.match === playerTwoResult.match), 1);
    }

    /**
     * Remove a player from an elimination tournament/playoffs.
     * @param tournament The tournament for which the player is being removed.
     * @param player The player being removed.
     * @internal
     */
    static eliminationRemovePlayer(tournament: Swiss | RoundRobin | Elimination, player: Player): void {
        
        // Find the player's current match
        const match = tournament.matches.find(m => m.round === tournament.currentRound && (m.playerOne === player.id || m.playerTwo === player.id));
        if (match !== undefined) {
            if (match.active === true) {
                const result: [number, number] = match.playerOne === player.id ? [0, Math.ceil(tournament.bestOf / 2)] : [Math.ceil(tournament.bestOf / 2), 0];
                Tournament.eliminationResult(tournament, match.id, result);
            }

            // If the player was in the winner's bracket of a double elimination tournament, fix routing in loser's bracket
            if (match.losersPath !== null) {
                const nextMatch = tournament.matches.find(m => m.id === match.losersPath);
                if (nextMatch.playerTwo === null) {
                    nextMatch.playerOne = null;
                    const moveToMatchID = nextMatch.winnersPath;
                    const moveFromMatch = tournament.matches.find(m => (m.winnersPath === nextMatch.id || m.losersPath === nextMatch.id) && m.playerOne !== player.id && m.playerTwo !== player.id);
                    if (moveFromMatch.winnersPath === nextMatch.id) {
                        moveFromMatch.winnersPath = moveToMatchID;
                    } else {
                        moveFromMatch.losersPath = moveToMatchID;
                    }
                } else {
                    nextMatch.active = false;
                    const winnersMatch = tournament.matches.find(m => m.id === nextMatch.winnersPath);
                    if (winnersMatch.playerOne === null) {
                        if (nextMatch.playerOne !== player.id) {
                            winnersMatch.playerOne = nextMatch.playerOne;
                        } else {
                            winnersMatch.playerOne = nextMatch.playerTwo;
                        }
                    }
                    else if (winnersMatch.playerTwo === null) {
                        if (nextMatch.playerOne !== player.id) {
                            winnersMatch.playerTwo = nextMatch.playerOne;
                        } else {
                            winnersMatch.playerTwo = nextMatch.playerTwo;
                        }
                        winnersMatch.active = true;
                    }
                }
            }
        }
    }

}

/** Class representing a Swiss pairing tournament. */
class Swiss extends Tournament {
    
    /** 
     * Number of rounds in the tournament. If 0, it will be determined by the number of players (base 2 logarithm of the number of players, rounded up). 
     * @default 0
    */
    rounds: number;

    /** 
     * Format for the playoffs. 
     * @default 0
    */
    playoffs: 'none' | 'single elimination' | 'double elimination';

    /** 
     * Number of possible games for a match.
     * @default 1
    */
    bestOf: number;

    /** 
     * Number of points assigned to a bye match. 
     * @default 1
    */
    pointsForBye: number;

    /** 
     * How to cut for playoffs. 
     * @default {type: 'none', limit: 0}
    */
    cut: {
        type: 'none' | 'rank' | 'points',
        limit: number
    };

    /** 
     * Tiebreakers that will be used for the tournament in order of precedence. 
     * @default ['solkoff', 'cumulative']
    */
    tiebreakers: [
        'median buchholz' |
        'solkoff' |
        'sonneborn berger' |
        'cumulative' |
        'versus' |
        'game win percentage' |
        'opponent game win percentage' |
        'opponent match win percentage' |
        'opponent opponent match win percentage'
    ];

    constructor(opt: {
        id: string,
        name: string,
        format: 'elimination'| 'swiss' | 'round robin',
        sorting?: 'none' | 'ascending' | 'descending',
        consolation?: boolean,
        playerLimit?: number,
        pointsForWin?: number,
        pointsForDraw?: number,
        pointsForBye?: number,
        rounds?: number,
        playoffs?: 'none' | 'single elimination' | 'double elimination',
        bestOf?: number,
        cut?: {
            type: 'none' | 'rank' | 'points',
            limit: number
        },
        tiebreakers?: [
            'median buchholz' |
            'solkoff' |
            'sonneborn berger' |
            'cumulative' |
            'versus' |
            'game win percentage' |
            'opponent game win percentage' |
            'opponent match win percentage' |
            'opponent opponent match win percentage'
        ]
    }) {
        super(opt);

        // Default values
        let options = Object.assign({
            rounds: 0,
            playoffs: 'none',
            bestOf: 1,
            pointsForBye: 1,
            cut: {
                type: 'none',
                limit: 0
            },
            tiebreakers: ['solkoff', 'cumulative']
        }, opt);

        this.rounds = options.rounds;
        this.playoffs = options.playoffs;
        this.bestOf = options.bestOf;
        this.pointsForBye = opt.hasOwnProperty('pointsForWin') && !opt.hasOwnProperty('pointsForBye') ? opt.pointsForWin : options.pointsForBye;
        this.cut = options.cut;
        this.tiebreakers = options.tiebreakers;
    }

    /**
     * Starts the tournament.
     */
    startEvent(): void {

        // Need at least 2 players
        if (this.players.length < 2) {
            throw `Swiss tournaments require at least 2 players, and there are currently ${this.players.length} players enrolled.`;
        }

        // Set tournament as active
        this.status = 'active';

        // Determine number of rounds, if not initially set
        if (this.rounds === 0) this.rounds = Math.ceil(Math.log2(this.players.length));

        // Create matches
        this.currentRound++;
        Pairings.swiss(this);

        // Process byes
        const byes = this.matches.filter(match => match.round === this.currentRound && match.playerTwo === null);
        byes.forEach(bye => {
            const player = this.players.find(p => p.id === bye.playerOne);
            player.results.push({
                match: bye.id,
                round: bye.round,
                opponent: null,
                outcome: 'bye',
                matchPoints: this.pointsForBye,
                gamePoints: Math.ceil(this.bestOf / 2) * this.pointsForBye,
                games: Math.ceil(this.bestOf / 2)
            });
            player.pairingBye = true;
            player.matchCount++;
            player.matchPoints += this.pointsForBye;
            player.gameCount += Math.ceil(this.bestOf / 2);
            player.gamePoints += Math.ceil(this.bestOf / 2) * this.pointsForBye;
            bye.result.playerOneWins = Math.ceil(this.bestOf / 2);
        });
    }

    /**
     * Create the next round of the tournament.
     */
    nextRound(): void {

        // Can't start the next round if there are active matches
        if (this.matches.some(match => match.active === true)) {
            throw `Can not start the next round with ${this.matches.reduce((sum, match) => match.active === true ? sum + 1 : sum, 0)} active matches remaining.`;
        }

        // Can't create new rounds while the tournament isn't active
        if (this.status !== 'active') {
            throw `Tournament can only create new rounds while active, and the current status is ${this.status}.`;
        }

        // Check if it's time to start playoffs
        if (this.currentRound === this.rounds) {
            if (this.playoffs === 'none') {
                this.status = 'finished';
                return;
            } else {
                this.status = 'playoffs';
                if (this.cut.type === 'points') {
                    if (this.cut.limit !== 0) {
                        const cutPlayers = this.players.filter(player => player.matchPoints < this.cut.limit);
                        cutPlayers.forEach(player => player.active = false);
                    }
                } else if (this.cut.type === 'rank') {
                    if (this.cut.limit !== 0) {
                        Tiebreakers.compute(this);
                        const sortedPlayers = Tiebreakers.sort(this.players.filter(player => player.active === true), this);
                        const cutPlayers = sortedPlayers.slice(this.cut.limit);
                        cutPlayers.forEach(player => player.active = false);
                    }
                }
                this.currentRound++;
                if (this.playoffs === 'single elimination') {
                    Pairings.singleElimination(this);
                } else {
                    Pairings.doubleElimination(this);
                }
                return;
            }
        }

        // Create matches
        this.currentRound++;
        Pairings.swiss(this);

        // Process byes
        const byes = this.matches.filter(match => match.round === this.currentRound && match.playerTwo === null);
        byes.forEach(bye => {
            const player = this.players.find(p => p.id === bye.playerOne);
            player.results.push({
                match: bye.id,
                round: bye.round,
                opponent: null,
                outcome: 'bye',
                matchPoints: this.pointsForBye,
                gamePoints: Math.ceil(this.bestOf / 2) * this.pointsForBye,
                games: Math.ceil(this.bestOf / 2)
            });
            player.pairingBye = true;
            player.matchCount++;
            player.matchPoints += this.pointsForBye;
            player.gameCount += Math.ceil(this.bestOf / 2);
            player.gamePoints += Math.ceil(this.bestOf / 2) * this.pointsForBye;
            bye.result.playerOneWins = Math.ceil(this.bestOf / 2);
        });
    }

    /**
     * Record a result for the tournament.
     * @param match ID for the match being reported.
     * @param result Array containing player one's game wins, player two's game wins, and (optionally) the number of draws.
     */
    enterResult(match: string, result: [number, number, number?]) : void {

        const res = result[2] === undefined ? [...result, 0] : [...result];

        // If it's the playoffs, use elimination to process the result
        if (this.status === 'playoffs') {
            Tournament.eliminationResult(this, match, [res[0], res[1]]);
            return;
        }

        // Otherwise use standard result process
        Tournament.standardResult(this, match, [res[0], res[1], res[2]]);
        return;
    }

    /**
     * Erase the result of a reported match.
     * @param match ID for the match to reset.
     */
    eraseResult(match: string): void {

        // Get the match
        const matchToErase = this.matches.find(m => m.id === match);
        if (matchToErase === undefined) {
            throw `Can't find a match with ID ${match}.`;
        }

        if (matchToErase.active === true) {
            throw `Can't erase results of a match that is still active.`;
        }

        if (this.status === 'playoffs') {
            // Get the players
            const playerOne = this.players.find(player => player.id === matchToErase.playerOne);
            const playerTwo = this.players.find(player => player.id === matchToErase.playerTwo);
            let winnersMatch: Match;
            let losersMatch: Match;
            let formerWinner: Player;
            let formerLoser: Player;
            if (matchToErase.result.playerOneWins > matchToErase.result.playerTwoWins) {
                formerWinner = playerOne;
                formerLoser = playerTwo;
            } else {
                formerWinner = playerTwo;
                formerLoser = playerOne;
            }
            formerWinner.active = true;
            formerLoser.active = true;
            winnersMatch = this.matches.find(m => m.id === matchToErase.winnersPath);
            if (winnersMatch.playerOne === formerWinner.id) {
                winnersMatch.playerOne = null;
            } else if (winnersMatch.playerTwo === formerWinner.id) {
                winnersMatch.playerTwo = null;
                winnersMatch.active = false;
            }
            if (matchToErase.losersPath !== null) {
                losersMatch = this.matches.find(m => m.id === matchToErase.losersPath);
                if (losersMatch.playerOne === formerLoser.id) {
                    losersMatch.playerOne = null;
                } else if (losersMatch.playerTwo === formerLoser.id) {
                    losersMatch.playerTwo = null;
                    losersMatch.active = false;
                }
            } else {
                formerLoser.active = true;
            }
        }

        Tournament.eraseResult(this, matchToErase);
    }

    /**
     * Create a new player and add them to the tournament.
     * @param opt User-defined options for a new player.
     * @returns The newly created player.
     */
    addPlayer(opt: {
        alias: string,
        id?: string,
        seed?: number,
        initialByes?: number,
        missingResults?: 'byes' | 'losses'
    }) : Player {

        // Default values
        let options = Object.assign({
            id: randomString.generate({length: 10, charset: 'alphanumeric'}),
            seed: 0,
            initialByes: 0,
            missingResults: 'losses'
        }, opt);

        const player = Tournament.newPlayer(this, {
            alias: options.alias,
            id: options.id,
            seed: options.seed,
            initialByes: options.initialByes
        });

        // Handling missed rounds due to tardiness
        if (this.status === 'active') {
            for (let i = 0; i < this.currentRound; i++) {
                let matchID = randomString.generate({length: 10, charset: 'alphanumeric'});
                while (this.matches.some(match => match.id === matchID)) {
                    matchID = randomString.generate({length: 10, charset: 'alphanumeric'});
                }
                const match = new Match({
                    id: matchID,
                    match: 0,
                    round: i + 1,
                    playerOne: player.id,
                    playerTwo: null
                });
                if (options.missingResults === 'byes') {
                    player.results.push({
                        match: matchID,
                        round: i + 1,
                        opponent: null,
                        outcome: 'bye',
                        matchPoints: this.pointsForBye,
                        gamePoints: Math.ceil(this.bestOf / 2) * this.pointsForBye,
                        games: Math.ceil(this.bestOf / 2)
                    });
                    player.pairingBye = true;
                    player.matchCount++;
                    player.matchPoints += this.pointsForBye;
                    player.gameCount += Math.ceil(this.bestOf / 2);
                    player.gamePoints += Math.ceil(this.bestOf / 2) * this.pointsForBye;
                    match.result.playerOneWins = Math.ceil(this.bestOf / 2);
                } else {
                    player.results.push({
                        match: matchID,
                        round: i + 1,
                        opponent: null,
                        outcome: 'loss',
                        matchPoints: 0,
                        gamePoints: 0,
                        games: Math.ceil(this.bestOf / 2)
                    });
                    player.matchCount++;
                    player.gameCount += Math.ceil(this.bestOf / 2);
                }
                this.matches.push(match);
            }
        }

        return player;
    }

    /**
     * Remove a player from the tournament.
     * @param id ID of the player to remove.
     * @returns The player that was removed.
     */
    removePlayer(id: string): Player {
        
        const player = this.players.find(p => p.id === id);

        // If the player can't be found
        if (player === undefined) {
            throw `Can not find a player with ID ${id}.`;
        }

        // If the player has already been removed
        if (player.active === false) {
            throw `${player.alias} has already been removed from the tournament.`;
        }

        // No removing players once the tournament is over
        if (this.status === 'finished' || this.status === 'aborted') {
            throw `Can not remove players if the tournament is ${this.status}.`;
        }

        // Remove the player from the tournament
        if (this.status === 'registration') {
            const index = this.players.findIndex(p => p.id === player.id);
            this.players.splice(index, 1);
        } else if (this.status === 'playoffs') {
            Tournament.eliminationRemovePlayer(this, player);
        } else {
            const match = this.matches.find(m => m.round === this.currentRound && (m.playerOne === player.id || m.playerTwo === player.id));
            if (match !== undefined && match.active === true) {
                const result: [number, number, number] = match.playerOne === player.id ? [0, Math.ceil(this.bestOf / 2), 0] : [Math.ceil(this.bestOf / 2), 0, 0];
                Tournament.standardResult(this, match.id, result);
            }
            player.active = false;
        }

        return player;
    }
}

/** Class representing a round-robin pairing tournament. */
class RoundRobin extends Tournament {

    /** 
     * Format for the playoffs. 
     * @default 'none'
    */
    playoffs: 'none' | 'single elimination' | 'double elimination';

    /** 
     * Number of possible games for a match. 
     * @default 1
    */
    bestOf: number;

    /** 
     * Number of points assigned to a bye match. 
     * @default 1
    */
    pointsForBye: number;

    /** 
     * How to cut for playoffs. 
     * @default {type: 'none', limit: 0}
    */
    cut: {
        type: 'none' | 'rank' | 'points',
        limit: number
    };

    /** 
     * If the tournament is double round-robin or not. 
     * @default false
    */
    double: boolean;

    /** 
     * Tiebreakers that will be used for the tournament in order of precedence. 
     * @default ['sonneborn berger', 'versus']
    */
    tiebreakers: [
        'median buchholz' |
        'solkoff' |
        'sonneborn berger' |
        'cumulative' |
        'versus' |
        'game win percentage' |
        'opponent game win percentage' |
        'opponent match win percentage' |
        'opponent opponent match win percentage'
    ];

    constructor(opt: {
        id: string,
        name: string,
        format: 'elimination'| 'swiss' | 'round robin',
        sorting?: 'none' | 'ascending' | 'descending',
        consolation?: boolean,
        playerLimit?: number,
        pointsForWin?: number,
        pointsForDraw?: number,
        pointsForBye?: number,
        playoffs?: 'none' | 'single elimination' | 'double elimination',
        bestOf?: number,
        cut?: {
            type: 'none' | 'rank' | 'points',
            limit: number
        },
        double?: boolean,
        tiebreakers?: [
            'median buchholz' |
            'solkoff' |
            'sonneborn berger' |
            'cumulative' |
            'versus' |
            'game win percentage' |
            'opponent game win percentage' |
            'opponent match win percentage' |
            'opponent opponent match win percentage'
        ]
    }) {
        super(opt);

        // Default values
        let options = Object.assign({
            playoffs: 'none',
            bestOf: 1,
            pointsForBye: 1,
            cut: {
                type: 'none',
                limit: 0
            },
            double: false,
            tiebreakers: ['sonneborn berger', 'versus']
        }, opt);

        this.playoffs = options.playoffs;
        this.bestOf = options.bestOf;
        this.pointsForBye = opt.hasOwnProperty('pointsForWin') && !opt.hasOwnProperty('pointsForBye') ? opt.pointsForWin : options.pointsForBye;
        this.cut = options.cut;
        this.double = options.double;
        this.tiebreakers = options.tiebreakers;
    }

    /**
     * Starts the tournament.
     */
    startEvent(): void {
        
        // Need at least 2 players
        if (this.players.length < 2) {
            throw `Round-Robin tournaments require at least 2 players, and there are currently ${this.players.length} players enrolled`;
        }

        // Set tournament as active
        this.status = 'active';

        // Create matches
        this.currentRound++;
        Pairings.roundRobin(this);

        // Process bye, if necessary
        const byes = this.matches.filter(match => match.round === this.currentRound && (match.playerOne === null || match.playerTwo === null));
        byes.forEach(bye => {
            const id = bye.playerTwo === null ? bye.playerOne : bye.playerTwo;
            const player = this.players.find(p => p.id === id);
            player.results.push({
                match: bye.id,
                round: bye.round,
                opponent: null,
                outcome: 'bye',
                matchPoints: this.pointsForBye,
                gamePoints: Math.ceil(this.bestOf / 2) * this.pointsForBye,
                games: Math.ceil(this.bestOf / 2)
            });
            player.pairingBye = true;
            player.matchCount++;
            player.matchPoints += this.pointsForBye;
            player.gameCount += Math.ceil(this.bestOf / 2);
            player.gamePoints += Math.ceil(this.bestOf / 2) * this.pointsForBye;
            if (bye.playerTwo === null) bye.result.playerOneWins = Math.ceil(this.bestOf / 2);
            else bye.result.playerTwoWins = Math.ceil(this.bestOf / 2);
        });
    }

    /**
     * Create the next round of the tournament.
     */
     nextRound(): void {

        // Can't start the next round if there are active matches
        if (this.matches.some(match => match.active === true)) {
            throw `Can not start the next round with ${this.matches.reduce((sum, match) => match.active === true ? sum + 1 : sum, 0)} active matches remaining`;
        }

        // Can't create new rounds while the tournament isn't active
        if (this.status !== 'active') {
            throw `Tournament can only create new rounds while active, and the current status is ${this.status}.`;
        }

        // Check if it's time to start playoffs
        if (this.currentRound === this.matches.reduce((currentMax, currentMatch) => Math.max(currentMax, currentMatch.round), 0)) {
            if (this.playoffs === 'none') {
                this.status = 'finished';
                return;
            } else {
                this.status = 'playoffs';
                if (this.cut.type === 'points') {
                    if (this.cut.limit !== 0) {
                        const cutPlayers = this.players.filter(player => player.matchPoints < this.cut.limit);
                        cutPlayers.forEach(player => player.active = false);
                    }
                } else if (this.cut.type === 'rank') {
                    if (this.cut.limit !== 0) {
                        Tiebreakers.compute(this);
                        const sortedPlayers = Tiebreakers.sort(this.players.filter(player => player.active === true), this);
                        const cutPlayers = sortedPlayers.slice(this.cut.limit);
                        cutPlayers.forEach(player => player.active = false);
                    }
                }
                this.currentRound++;
                if (this.playoffs === 'single elimination') {
                    Pairings.singleElimination(this);
                } else {
                    Pairings.doubleElimination(this);
                }
                return;
            }
        }

        // Create matches
        this.currentRound++;
        const nextRound = this.matches.filter(match => match.round === this.currentRound && match.playerOne !== null && match.playerTwo !== null);
        nextRound.forEach(match => match.active = true);

        // Process byes
        const byes = this.matches.filter(match => match.round === this.currentRound && (match.playerOne === null || match.playerTwo === null));
        for (let i = 0; i < byes.length; i++) {
            const bye = byes[i];
            if (bye.playerOne === null && bye.playerTwo === null) continue;
            const id = bye.playerTwo === null ? bye.playerOne : bye.playerTwo;
            const player = this.players.find(p => p.id === id);
            player.results.push({
                match: bye.id,
                round: bye.round,
                opponent: null,
                outcome: 'bye',
                matchPoints: this.pointsForBye,
                gamePoints: Math.ceil(this.bestOf / 2) * this.pointsForBye,
                games: Math.ceil(this.bestOf / 2)
            });
            player.pairingBye = true;
            player.matchCount++;
            player.matchPoints += this.pointsForBye;
            player.gameCount += Math.ceil(this.bestOf / 2);
            player.gamePoints += Math.ceil(this.bestOf / 2) * this.pointsForBye;
            if (bye.playerTwo === null) bye.result.playerOneWins = Math.ceil(this.bestOf / 2);
            else bye.result.playerTwoWins = Math.ceil(this.bestOf / 2);
        };
    }

    /**
     * Record a result for the tournament.
     * @param match ID for the match being reported.
     * @param result Array containing player one's game wins, player two's game wins, and (optionally) the number of draws.
     */
     enterResult(match: string, result: [number, number, number?]) : void {

        const res = result[2] === undefined ? [...result, 0] : [...result];

        // If it's the playoffs, use elimination to process the result
        if (this.status === 'playoffs') {
            Tournament.eliminationResult(this, match, [res[0], res[1]]);
            return;
        }

        // Otherwise use standard result process
        Tournament.standardResult(this, match, [res[0], res[1], res[2]]);
        return;
    }

    /**
     * Erase the result of a reported match.
     * @param match ID for the match to reset.
     */
    eraseResult(match: string): void {

        // Get the match
        const matchToErase = this.matches.find(m => m.id === match);
        if (matchToErase === undefined) {
            throw `Can't find a match with ID ${match}.`;
        }

        if (matchToErase.active === true) {
            throw `Can't erase results of a match that is still active.`;
        }

        if (this.status === 'playoffs') {
            // Get the players
            const playerOne = this.players.find(player => player.id === matchToErase.playerOne);
            const playerTwo = this.players.find(player => player.id === matchToErase.playerTwo);
            let winnersMatch: Match;
            let losersMatch: Match;
            let formerWinner: Player;
            let formerLoser: Player;
            if (matchToErase.result.playerOneWins > matchToErase.result.playerTwoWins) {
                formerWinner = playerOne;
                formerLoser = playerTwo;
            } else {
                formerWinner = playerTwo;
                formerLoser = playerOne;
            }
            formerWinner.active = true;
            formerLoser.active = true;
            winnersMatch = this.matches.find(m => m.id === matchToErase.winnersPath);
            if (winnersMatch.playerOne === formerWinner.id) {
                winnersMatch.playerOne = null;
            } else if (winnersMatch.playerTwo === formerWinner.id) {
                winnersMatch.playerTwo = null;
                winnersMatch.active = false;
            }
            if (matchToErase.losersPath !== null) {
                losersMatch = this.matches.find(m => m.id === matchToErase.losersPath);
                if (losersMatch.playerOne === formerLoser.id) {
                    losersMatch.playerOne = null;
                } else if (losersMatch.playerTwo === formerLoser.id) {
                    losersMatch.playerTwo = null;
                    losersMatch.active = false;
                }
            } else {
                formerLoser.active = true;
            }
        }

        Tournament.eraseResult(this, matchToErase);
    }

    /**
     * Create a new player and add them to the tournament.
     * @param opt User-defined options for a new player.
     * @returns The newly created player.
     */
    addPlayer(opt: {
        alias: string,
        id?: string,
        seed?: number
    }) : Player {

        // Default values
        let options = Object.assign({
            id: randomString.generate({length: 10, charset: 'alphanumeric'}),
            seed: 0,
            initialByes: 0
        }, opt);

        const player = Tournament.newPlayer(this, {
            alias: options.alias,
            id: options.id,
            seed: options.seed,
            initialByes: options.initialByes
        });

        return player;
    }

    /**
     * Remove a player from the tournament.
     * @param id ID of the player to remove.
     * @returns The player that was removed.
     */
    removePlayer(id: string): Player {
        
        const player = this.players.find(p => p.id === id);

        // If the player can't be found
        if (player === undefined) {
            throw `Can not find a player with ID ${id}.`;
        }

        // If the player has already been removed
        if (player.active === false) {
            throw `${player.alias} has already been removed from the tournament.`;
        }

        // No removing players once the tournament is over
        if (this.status === 'finished' || this.status === 'aborted') {
            throw `Can not remove players if the tournament is ${this.status}.`;
        }

        // Remove the player from the tournament
        if (this.status === 'registration') {
            const index = this.players.findIndex(p => p.id === player.id);
            this.players.splice(index, 1);
        } else if (this.status === 'playoffs') {
            Tournament.eliminationRemovePlayer(this, player);
        } else {
            const match = this.matches.find(m => m.round === this.currentRound && (m.playerOne === player.id || m.playerTwo === player.id));
            if (match !== undefined && match.active === true) {
                const result: [number, number, number] = match.playerOne === player.id ? [0, Math.ceil(this.bestOf / 2), 0] : [Math.ceil(this.bestOf / 2), 0, 0];
                Tournament.standardResult(this, match.id, result);
            }
            for (let i = this.currentRound + 1; i < this.matches.reduce((currentMax, currentMatch) => Math.max(currentMax, currentMatch.round), 0); i++) {
                const futureMatch = this.matches.find(m => m.round === i && (m.playerOne === player.id || m.playerTwo === player.id));
                if (futureMatch.playerOne === player.id) {
                    futureMatch.playerOne = null;
                } else {
                    futureMatch.playerTwo = null;
                }
            }
            player.active = false;
        }

        return player;
    }
}

/**
 * Class representing an elimination tournament.
 * @extends Tournament
 */
class Elimination extends Tournament {
    
    /** 
     * Whether or not to do double elimination. 
     * @default false
    */
    double: boolean;

    /**
     * This exists solely for removing players from the playoffs of swiss and round robin events
     * @hidden
     */
    bestOf: number;

    /** 
     * Tiebreakers that will be used for the tournament in order of precedence. 
     * This is ignored in single elimination, but needed for standings.
     * @default []
    */
     tiebreakers: [
        'median buchholz' |
        'solkoff' |
        'sonneborn berger' |
        'cumulative' |
        'versus' |
        'game win percentage' |
        'opponent game win percentage' |
        'opponent match win percentage' |
        'opponent opponent match win percentage'
    ] | [];

    constructor(opt: {
        id: string,
        name: string,
        format: 'elimination'| 'swiss' | 'round robin',
        sorting?: 'none' | 'ascending' | 'descending',
        consolation?: boolean,
        playerLimit?: number,
        pointsForWin?: number,
        pointsForDraw?: number,
        double?: boolean
    }) {
        super(opt);

        // Default values
        let options = Object.assign({
            double: false,
            bestOf: 1,
            tiebreakers: []
        }, opt);

        this.double = options.double;
        this.bestOf = options.bestOf;
        this.tiebreakers = options.tiebreakers;
    }

    /**
     * Starts the tournament.
     */
    startEvent(): void {
        
        // Need at least 2 players
        if (this.players.length < 2) {
            throw `Elimination tournaments require at least 2 players, and there are currently ${this.players.length} players enrolled`;
        }

        // Set tournament as active
        this.status = 'active';

        // Create matches
        this.currentRound++;
        if (this.double) {
            Pairings.doubleElimination(this);
        } else {
            Pairings.singleElimination(this);
        }
    }

    /**
     * Record a result for the tournament.
     * @param match ID for the match being reported.
     * @param result Array containing player one's game wins, player two's game wins, and (optionally) the number of draws.
     */
     enterResult(match: string, result: [number, number, ]) : void {
        
        // Use elimination result
        Tournament.eliminationResult(this, match, result);
    }

    /**
     * Erase the result of a reported match.
     * @param match ID for the match to reset.
     */
     eraseResult(match: string): void {

        // Get the match
        const matchToErase = this.matches.find(m => m.id === match);
        if (matchToErase === undefined) {
            throw `Can't find a match with ID ${match}.`;
        }

        if (matchToErase.active === true) {
            throw `Can't erase results of a match that is still active.`;
        }

        // Get the players
        const playerOne = this.players.find(player => player.id === matchToErase.playerOne);
        const playerTwo = this.players.find(player => player.id === matchToErase.playerTwo);
        let winnersMatch: Match;
        let losersMatch: Match;
        let formerWinner: Player;
        let formerLoser: Player;
        if (matchToErase.result.playerOneWins > matchToErase.result.playerTwoWins) {
            formerWinner = playerOne;
            formerLoser = playerTwo;
        } else {
            formerWinner = playerTwo;
            formerLoser = playerOne;
        }
        formerWinner.active = true;
        formerLoser.active = true;
        winnersMatch = this.matches.find(m => m.id === matchToErase.winnersPath);
        if (winnersMatch.playerOne === formerWinner.id) {
            winnersMatch.playerOne = null;
        } else if (winnersMatch.playerTwo === formerWinner.id) {
            winnersMatch.playerTwo = null;
            winnersMatch.active = false;
        }
        if (matchToErase.losersPath !== null) {
            losersMatch = this.matches.find(m => m.id === matchToErase.losersPath);
            if (losersMatch.playerOne === formerLoser.id) {
                losersMatch.playerOne = null;
            } else if (losersMatch.playerTwo === formerLoser.id) {
                losersMatch.playerTwo = null;
                losersMatch.active = false;
            }
        } else {
            formerLoser.active = true;
        }

        Tournament.eraseResult(this, matchToErase);
    }

    /**
     * Create a new player and add them to the tournament.
     * @param opt User-defined options for a new player.
     * @returns The newly created player.
     */
    addPlayer(opt: {
        alias: string,
        id?: string,
        seed?: number
    }) : Player {

        // Default values
        let options = Object.assign({
            id: randomString.generate({length: 10, charset: 'alphanumeric'}),
            seed: 0,
            initialByes: 0
        }, opt);

        const player = Tournament.newPlayer(this, {
            alias: options.alias,
            id: options.id,
            seed: options.seed,
            initialByes: options.initialByes
        });

        return player;
    }

    /**
     * Remove a player from the tournament.
     * @param id ID of the player to remove.
     * @returns The player that was removed.
     */
    removePlayer(id: string): Player {
        
        const player = this.players.find(p => p.id === id);

        // If the player can't be found
        if (player === undefined) {
            throw `Can not find a player with ID ${id}.`;
        }

        // If the player has already been removed
        if (player.active === false) {
            throw `${player.alias} has already been removed from the tournament.`;
        }

        // No removing players once the tournament is over
        if (this.status === 'finished' || this.status === 'aborted') {
            throw `Can not remove players if the tournament is ${this.status}.`;
        }

        // Remove the player from the tournament
        if (this.status === 'registration') {
            const index = this.players.findIndex(p => p.id === player.id);
            this.players.splice(index, 1);
        } else {
            Tournament.eliminationRemovePlayer(this, player);
        }

        return player;
    }
}

export { BasicTournamentProperties, Structure, Tournament, Swiss, RoundRobin, Elimination };
