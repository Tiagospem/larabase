export class Helpers {
  static columnStructure = [];

  static setColumnStructure(columnStructure) {
    if (Array.isArray(columnStructure) && columnStructure.length > 0) {
      this.columnStructure = columnStructure;
    }
  }

  static getColumnInfo(column) {
    // If the column structure is empty, try to recover from localStorage
    if (this.columnStructure.length === 0) {
      this.recoverColumnStructure();
    }

    return this.columnStructure.find((col) => col.name === column) || null;
  }

  static recoverColumnStructure() {
    try {
      // Find any saved structure in localStorage
      const keys = Object.keys(localStorage);
      const structureKeys = keys.filter((key) => key.startsWith("table_structure:"));

      // Use the most recently used structure if available
      if (structureKeys.length > 0) {
        // Sort by last accessed time if available
        const mostRecentKey = structureKeys[structureKeys.length - 1];
        const savedStructure = localStorage.getItem(mostRecentKey);

        if (savedStructure) {
          const parsedStructure = JSON.parse(savedStructure);
          if (Array.isArray(parsedStructure) && parsedStructure.length > 0) {
            this.columnStructure = parsedStructure;
            console.log("Recovered column structure from localStorage");
            return true;
          }
        }
      }
    } catch (e) {
      console.error("Error recovering column structure:", e);
    }
    return false;
  }

  static isDateField(column) {
    const colInfo = this.getColumnInfo(column);

    if (colInfo && colInfo.type) {
      const type = colInfo.type.toLowerCase();
      return type.includes("date") || type.includes("time") || type.includes("timestamp");
    }

    return false;
  }

  static isNumberField(column) {
    const colInfo = this.getColumnInfo(column);

    if (colInfo && colInfo.type) {
      const type = colInfo.type.toLowerCase();

      if (type.includes("enum")) {
        return false;
      }

      return (
        type.includes("int") ||
        type.includes("decimal") ||
        type.includes("float") ||
        type.includes("double") ||
        type.includes("numeric") ||
        type.includes("real") ||
        type.includes("bit") ||
        type.includes("serial")
      );
    }

    return false;
  }

  static isLongTextField(column) {
    const colInfo = this.getColumnInfo(column);
    if (colInfo && colInfo.type) {
      const type = colInfo.type.toLowerCase();
      if (type.includes("text") || type.includes("json") || type.includes("mediumtext") || type.includes("longtext") || type.includes("blob") || type.includes("clob")) {
        return true;
      }
    }

    return false;
  }

  static isBooleanField(column) {
    const colInfo = this.getColumnInfo(column);
    if (colInfo && colInfo.type) {
      const type = colInfo.type.toLowerCase();
      return type.includes("bool") || type.includes("tinyint(1)");
    }

    return false;
  }

  static getFieldTypeLabel(column) {
    const colInfo = this.getColumnInfo(column);

    if (colInfo && colInfo.type) {
      return colInfo.type;
    }

    return "Unknown";
  }

  static formatCellValue(column, value) {
    // Handle null values
    if (value == null) {
      return "";
    }

    // Handle date fields
    if (this.isDateField(column)) {
      let dateObj = new Date(value);

      if (dateObj instanceof Date && !isNaN(dateObj.getTime())) {
        const pad = (n) => String(n).padStart(2, "0");
        const Y = dateObj.getFullYear();
        const m = pad(dateObj.getMonth() + 1);
        const d = pad(dateObj.getDate());
        const H = pad(dateObj.getHours());
        const i = pad(dateObj.getMinutes());
        const s = pad(dateObj.getSeconds());
        return `${Y}-${m}-${d} ${H}:${i}:${s}`;
      }
    }

    if (typeof value === "object" && value !== null) {
      try {
        const jsonString = JSON.stringify(value);
        if (jsonString.length > 100) {
          return jsonString.substring(0, 100) + "...";
        }
        return jsonString;
      } catch (e) {
        console.warn("Error stringifying object:", e);
        return String(value);
      }
    }

    return String(value);
  }
}
