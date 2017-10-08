    /**
     * @name getDataPointDate
     * @description Extracts and creates a new {Date} object out of the Datetime on the usage datum.
     * @param datum - d3 data getDataPointDate
     * @return {Date} returns a date time object
     */
    export function getDataPointDate (datum):Date { return new Date(datum.kDateTime); }
    
    /**
     * @name getDayRange
     * @description Calculates the difference between the start and end dates
     * @param {string} first - start date of the domain
     * @param {string} second - end date of the domain
     * @return {number} number range
     */
export function getNumberOfDaysInDomain(first, second):number {
        return Math.round((second - first) / (1000 * 60 * 60 * 24));
    }
