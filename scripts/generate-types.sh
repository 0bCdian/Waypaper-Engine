#!/bin/bash

# Type generation script to keep Go and TypeScript contracts in sync
# This script generates TypeScript types from Go structs

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
GO_CONTRACTS_DIR="$PROJECT_ROOT/daemon-go/internal/contracts"
TS_CONTRACTS_DIR="$PROJECT_ROOT/shared/types/contracts"

echo "🔧 Type Generation Script"
echo "========================="
echo "Project root: $PROJECT_ROOT"
echo "Go contracts: $GO_CONTRACTS_DIR"
echo "TS contracts: $TS_CONTRACTS_DIR"
echo ""

# Check if required directories exist
if [ ! -d "$GO_CONTRACTS_DIR" ]; then
    echo "❌ Go contracts directory not found: $GO_CONTRACTS_DIR"
    exit 1
fi

if [ ! -d "$TS_CONTRACTS_DIR" ]; then
    echo "❌ TypeScript contracts directory not found: $TS_CONTRACTS_DIR"
    exit 1
fi

# Function to convert Go type to TypeScript type
go_to_ts_type() {
    local go_type="$1"
    case "$go_type" in
        "string") echo "string" ;;
        "int"|"int64") echo "number" ;;
        "float64") echo "number" ;;
        "bool") echo "boolean" ;;
        "time.Time") echo "string" ;;
        "[]string") echo "string[]" ;;
        "[]int64") echo "number[]" ;;
        "[]MonitorContract") echo "MonitorContract[]" ;;
        "[]ImageContract") echo "ImageContract[]" ;;
        "*string") echo "string | undefined" ;;
        "*int64") echo "number | undefined" ;;
        "*bool") echo "boolean | undefined" ;;
        "*time.Time") echo "string | undefined" ;;
        "any") echo "any" ;;
        *) echo "$go_type" ;;
    esac
}

# Function to convert Go field name to TypeScript field name
go_to_ts_field() {
    local go_field="$1"
    # Convert PascalCase to snake_case for JSON tags
    echo "$go_field" | sed 's/\([A-Z]\)/_\1/g' | tr '[:upper:]' '[:lower:]' | sed 's/^_//'
}

# Function to extract JSON tag from Go struct field
extract_json_tag() {
    local line="$1"
    if [[ $line =~ json:"([^"]*)" ]]; then
        echo "${BASH_REMATCH[1]}"
    else
        echo ""
    fi
}

# Function to extract struct name from Go struct definition
extract_struct_name() {
    local line="$1"
    if [[ $line =~ type\ ([A-Za-z0-9_]+) ]]; then
        echo "${BASH_REMATCH[1]}"
    else
        echo ""
    fi
}

# Function to extract field name from Go struct field
extract_field_name() {
    local line="$1"
    if [[ $line =~ ^\s*([A-Za-z0-9_]+) ]]; then
        echo "${BASH_REMATCH[1]}"
    else
        echo ""
    fi
}

# Function to extract field type from Go struct field
extract_field_type() {
    local line="$1"
    if [[ $line =~ ^\s*[A-Za-z0-9_]+\s+([A-Za-z0-9_*\[\]]+) ]]; then
        echo "${BASH_REMATCH[1]}"
    else
        echo ""
    fi
}

# Function to generate TypeScript interface from Go struct
generate_ts_interface() {
    local struct_name="$1"
    local struct_content="$2"
    
    echo "export interface ${struct_name} {"
    
    # Process each field
    while IFS= read -r line; do
        if [[ $line =~ ^\s*[A-Za-z0-9_]+\s+[A-Za-z0-9_*\[\]]+ ]]; then
            local field_name=$(extract_field_name "$line")
            local field_type=$(extract_field_type "$line")
            local json_tag=$(extract_json_tag "$line")
            
            # Convert Go type to TypeScript type
            local ts_type=$(go_to_ts_type "$field_type")
            
            # Use JSON tag as field name if available, otherwise use field name
            local ts_field_name="$field_name"
            if [ -n "$json_tag" ]; then
                ts_field_name="$json_tag"
            fi
            
            # Determine if field is optional
            local optional=""
            if [[ $field_type =~ ^\* ]]; then
                optional="?"
            fi
            
            echo "  ${ts_field_name}${optional}: ${ts_type};"
        fi
    done <<< "$struct_content"
    
    echo "}"
    echo ""
}

# Function to generate type guards
generate_type_guards() {
    echo "// Type guards for runtime validation"
    echo ""
    
    # Generate type guard for MonitorContract
    echo "export function isMonitorContract(obj: any): obj is MonitorContract {"
    echo "  return obj &&"
    echo "    typeof obj.name === 'string' &&"
    echo "    typeof obj.width === 'number' &&"
    echo "    typeof obj.height === 'number' &&"
    echo "    obj.position &&"
    echo "    typeof obj.position.x === 'number' &&"
    echo "    typeof obj.position.y === 'number' &&"
    echo "    typeof obj.currentImage === 'string';"
    echo "}"
    echo ""
    
    # Generate type guard for MonitorSelectionContract
    echo "export function isMonitorSelectionContract(obj: any): obj is MonitorSelectionContract {"
    echo "  return obj &&"
    echo "    typeof obj.id === 'string' &&"
    echo "    Array.isArray(obj.monitors) &&"
    echo "    obj.monitors.every(isMonitorContract) &&"
    echo "    typeof obj.mode === 'string' &&"
    echo "    ['individual', 'extend', 'clone'].includes(obj.mode);"
    echo "}"
    echo ""
    
    # Generate type guard for ImageContract
    echo "export function isImageContract(obj: any): obj is ImageContract {"
    echo "  return obj &&"
    echo "    typeof obj.id === 'number' &&"
    echo "    typeof obj.name === 'string' &&"
    echo "    typeof obj.path === 'string' &&"
    echo "    typeof obj.width === 'number' &&"
    echo "    typeof obj.height === 'number' &&"
    echo "    typeof obj.format === 'string';"
    echo "}"
    echo ""
    
    # Generate type guard for PlaylistContract
    echo "export function isPlaylistContract(obj: any): obj is PlaylistContract {"
    echo "  return obj &&"
    echo "    typeof obj.id === 'number' &&"
    echo "    typeof obj.name === 'string' &&"
    echo "    typeof obj.type === 'string' &&"
    echo "    ['timer', 'never', 'timeofday', 'dayofweek'].includes(obj.type) &&"
    echo "    typeof obj.showAnimations === 'boolean' &&"
    echo "    typeof obj.alwaysStartOnFirstImage === 'boolean' &&"
    echo "    typeof obj.currentImageIndex === 'number' &&"
    echo "    Array.isArray(obj.images) &&"
    echo "    obj.images.every(isImageContract);"
    echo "}"
    echo ""
}

# Function to generate utility functions
generate_utility_functions() {
    echo "// Utility functions for creating contracts"
    echo "export class ContractFactory {"
    echo "  public static createMonitorSelection("
    echo "    monitors: MonitorContract[],"
    echo "    mode: 'individual' | 'extend' | 'clone',"
    echo "    userLabel?: string"
    echo "  ): MonitorSelectionContract {"
    echo "    const id = monitors.map(m => m.name).join(',');"
    echo "    return {"
    echo "      id,"
    echo "      monitors,"
    echo "      mode,"
    echo "      metadata: {"
    echo "        createdAt: new Date().toISOString(),"
    echo "        lastUsed: new Date().toISOString(),"
    echo "        userLabel"
    echo "      }"
    echo "    };"
    echo "  }"
    echo ""
    echo "  public static createPlaylist("
    echo "    name: string,"
    echo "    type: 'timer' | 'never' | 'timeofday' | 'dayofweek',"
    echo "    images: ImageContract[],"
    echo "    options?: Partial<PlaylistConfigurationContract>"
    echo "  ): PlaylistContract {"
    echo "    return {"
    echo "      id: 0, // Will be set by the daemon"
    echo "      name,"
    echo "      type,"
    echo "      interval: options?.interval,"
    echo "      showAnimations: options?.showAnimations ?? true,"
    echo "      alwaysStartOnFirstImage: options?.alwaysStartOnFirstImage ?? false,"
    echo "      order: options?.order,"
    echo "      currentImageIndex: options?.currentImageIndex ?? 0,"
    echo "      images"
    echo "    };"
    echo "  }"
    echo ""
    echo "  public static createImage("
    echo "    id: number,"
    echo "    name: string,"
    echo "    path: string,"
    echo "    width: number,"
    echo "    height: number,"
    echo "    format: string,"
    echo "    options?: Partial<ImageContract>"
    echo "  ): ImageContract {"
    echo "    return {"
    echo "      id,"
    echo "      name,"
    echo "      path,"
    echo "      width,"
    echo "      height,"
    echo "      format,"
    echo "      rating: options?.rating ?? 0,"
    echo "      time: options?.time,"
    echo "      isChecked: options?.isChecked ?? false,"
    echo "      isSelected: options?.isSelected ?? false"
    echo "    };"
    echo "  }"
    echo "}"
    echo ""
}

# Main generation function
generate_types() {
    echo "🔄 Generating TypeScript types from Go contracts..."
    
    local output_file="$TS_CONTRACTS_DIR/generated.ts"
    
    # Start generating the TypeScript file
    cat > "$output_file" << 'EOF'
// Generated TypeScript types from Go contracts
// This file is auto-generated - do not edit manually
// Generated on: $(date)

EOF

    # Read the Go contracts file and generate TypeScript interfaces
    local current_struct=""
    local struct_content=""
    local in_struct=false
    
    while IFS= read -r line; do
        # Check if this is a struct definition
        if [[ $line =~ ^type\ [A-Za-z0-9_]+\ struct ]]; then
            # If we were processing a struct, generate it
            if [ -n "$current_struct" ] && [ -n "$struct_content" ]; then
                generate_ts_interface "$current_struct" "$struct_content" >> "$output_file"
            fi
            
            # Start new struct
            current_struct=$(extract_struct_name "$line")
            struct_content=""
            in_struct=true
        elif [[ $line =~ ^}$ ]] && [ "$in_struct" = true ]; then
            # End of struct
            if [ -n "$current_struct" ] && [ -n "$struct_content" ]; then
                generate_ts_interface "$current_struct" "$struct_content" >> "$output_file"
            fi
            current_struct=""
            struct_content=""
            in_struct=false
        elif [ "$in_struct" = true ] && [[ $line =~ ^\s*[A-Za-z0-9_]+\s+[A-Za-z0-9_*\[\]]+ ]]; then
            # This is a field in the struct
            struct_content+="$line"$'\n'
        fi
    done < "$GO_CONTRACTS_DIR/contracts.go"
    
    # Generate type guards
    generate_type_guards >> "$output_file"
    
    # Generate utility functions
    generate_utility_functions >> "$output_file"
    
    echo "✅ Generated TypeScript types: $output_file"
}

# Function to validate contracts
validate_contracts() {
    echo "🔍 Validating contracts..."
    
    # Check if Go contracts compile
    echo "  Checking Go contracts..."
    if ! go build "$GO_CONTRACTS_DIR/contracts.go" 2>/dev/null; then
        echo "❌ Go contracts have compilation errors"
        return 1
    fi
    echo "  ✅ Go contracts compile successfully"
    
    # Check if TypeScript contracts are valid
    echo "  Checking TypeScript contracts..."
    if ! npx tsc --noEmit "$TS_CONTRACTS_DIR/index.ts" 2>/dev/null; then
        echo "❌ TypeScript contracts have compilation errors"
        return 1
    fi
    echo "  ✅ TypeScript contracts compile successfully"
    
    echo "✅ All contracts are valid"
    return 0
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  generate    Generate TypeScript types from Go contracts"
    echo "  validate    Validate both Go and TypeScript contracts"
    echo "  sync        Generate and validate contracts"
    echo "  help        Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 generate"
    echo "  $0 validate"
    echo "  $0 sync"
}

# Main script logic
case "${1:-help}" in
    "generate")
        generate_types
        ;;
    "validate")
        validate_contracts
        ;;
    "sync")
        generate_types
        validate_contracts
        ;;
    "help"|*)
        show_usage
        ;;
esac

echo ""
echo "🎉 Type generation script completed!"
