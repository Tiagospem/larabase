export class Regex {
    static ISO_DATETIME_REGEX   = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
    static SPACE_DATETIME_REGEX = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/;
    static DATE_FIELD = /(created_at|updated_at|deleted_at|date|time|at$)/i;
    static NUMBER_FIELD = /(amount|price|cost|total|sum|count|number|qty|quantity|height|width|depth|size|order|position)/i;
    static BOOLEAN_FIELD = /(active|enabled|visible|published|featured|is_|has_)/i;

    static test(pattern, str) {
        return pattern.test(str);
    }
}