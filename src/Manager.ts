import * as randomString from 'randomized-string';
import * as Tournament from './Tournament.js';
import { Match } from './Match.js';
import { Player } from './Player.js';

/** Class representing an event manager. */
export class Manager {

    /** Array of tournaments being managed. */
    tournaments: Array<Tournament.Elimination | Tournament.Swiss | Tournament.RoundRobin>;
    
    constructor() {
        this.tournaments = [];
    }

    /**
     * Create a new tournament.
     * @param options User-defined options for a new tournament. All options can be found in the constructors of the Tournament classes.
     * @returns New tournament.
     */
    newTournament(opt?: object): Tournament.Elimination | Tournament.Swiss | Tournament.RoundRobin {

        let defaults: {
            id: string,
            name: string,
            format: 'elimination'| 'swiss' | 'round robin'
        } = {
            id: randomString.generate({length: 10, charset: 'alphanumeric'}),
            name: 'New Tournament',
            format: 'elimination'
        }
        
        // Default values
        let options: Tournament.BasicTournamentProperties = Object.assign(defaults, opt === undefined ? {} : opt);
        
        // No duplicate IDs
        while (this.tournaments.some(tournament => tournament.id === options.id)) {
            options.id = randomString.generate({length: 10, charset: 'alphanumeric'});
        }
        
        // Create tournament
        let tournament: Tournament.Elimination | Tournament.Swiss | Tournament.RoundRobin;
        switch (options.format) {
            case 'elimination':
                tournament = new Tournament.Elimination(options);
                break;
            case 'swiss':
                tournament = new Tournament.Swiss(options);
                break;
            case 'round robin':
                tournament = new Tournament.RoundRobin(options);
                break;
            }
        
        // Add tournament to list
        this.tournaments.push(tournament);
        
        return tournament;
    }

    /**
     * Reload a saved tournament.
     * @param tournament The tournament (object) to be reloaded.
     * @returns The reloaded tournament.
     */
    loadTournament(tournament: Tournament.Structure): Tournament.Elimination | Tournament.Swiss | Tournament.RoundRobin {
        
        // No loading a tournament already in the manager
        if (this.tournaments.some(t => t.id === tournament.id)) {
            throw `Tournament with ID ${tournament.id} already exists.`;
        }

        // Create tournament
        let loadedTournament: Tournament.Elimination | Tournament.Swiss | Tournament.RoundRobin;
        switch (tournament.format) {
            case 'elimination':
                loadedTournament = new Tournament.Elimination(tournament);
                break;
            case 'swiss':
                loadedTournament = new Tournament.Swiss(tournament);
                break;
            case 'round robin':
                loadedTournament = new Tournament.RoundRobin(tournament);
                break;
        }

        // Copy over all data
        Object.assign(loadedTournament, tournament);
        loadedTournament.players.forEach((player, index) => {
            const newPlayer = new Player({
                id: player.id,
                alias: player.alias,
                seed: player.seed
            });
            loadedTournament.players[index] = Object.assign(newPlayer, player);
        });
        loadedTournament.matches.forEach((match, index) => {
            const newMatch = new Match({
                id: match.id,
                round: match.round,
                match: match.match
            });
            loadedTournament.matches[index] = Object.assign(newMatch, match);
        });

        // Add tournament to list
        this.tournaments.push(loadedTournament);
        
        return loadedTournament;
    }

    /**
     * Remove a tournament from the manager.
     * @param id ID of the tournament to be removed.
     * @returns The deleted tournament.
     */
    deleteTournament(id: string): Tournament.Elimination | Tournament.Swiss | Tournament.RoundRobin {
        
        // Find tournament
        const index = this.tournaments.findIndex(t => t.id === id);
        if (index === -1) {
            throw `Tournament with ID ${id} was not found.`;
        }
        const tournament = this.tournaments[index];
            
        // If active, end the tournament
        if (tournament.status !== 'finished') tournament.status = 'aborted';
        
        // Remove the tournament from the list
        this.tournaments.splice(index, 1);
        return tournament;
    }
}
