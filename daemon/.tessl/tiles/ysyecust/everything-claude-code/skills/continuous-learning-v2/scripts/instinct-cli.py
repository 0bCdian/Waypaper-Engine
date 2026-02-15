#!/usr/bin/env python3
"""
instinct-cli.py - Manage instincts for the continuous learning system.

Commands:
    status  - Show current instincts and their confidence levels
    import  - Import instincts from a YAML/markdown file
    export  - Export instincts to a portable format
    evolve  - Re-evaluate instinct confidence based on recent observations
"""

import argparse
import json
import os
import sys
import time
from pathlib import Path

# --- Configuration ---
HOMUNCULUS_DIR = Path.home() / ".claude" / "homunculus"
INSTINCTS_DIR = HOMUNCULUS_DIR / "instincts" / "personal"
OBSERVATIONS_FILE = HOMUNCULUS_DIR / "observations.jsonl"


def parse_frontmatter(content):
    """Parse YAML-like frontmatter from a markdown instinct file."""
    metadata = {}
    body = content

    if content.startswith("---"):
        parts = content.split("---", 2)
        if len(parts) >= 3:
            frontmatter = parts[1].strip()
            body = parts[2].strip()
            for line in frontmatter.split("\n"):
                line = line.strip()
                if ":" in line:
                    key, value = line.split(":", 1)
                    key = key.strip()
                    value = value.strip()
                    # Handle numeric values
                    try:
                        value = float(value)
                        if value == int(value):
                            value = int(value)
                    except ValueError:
                        # Handle boolean values
                        if value.lower() == "true":
                            value = True
                        elif value.lower() == "false":
                            value = False
                    metadata[key] = value

    return metadata, body


def confidence_bar(confidence, width=20):
    """Render a visual confidence bar."""
    filled = int(confidence * width)
    empty = width - filled
    bar = "█" * filled + "░" * empty
    return f"[{bar}] {confidence:.0%}"


def cmd_status(args):
    """Show current instincts and their confidence levels."""
    if not INSTINCTS_DIR.exists():
        print("No instincts directory found.")
        print(f"  Expected: {INSTINCTS_DIR}")
        print("  Run the observer agent to begin collecting instincts.")
        return

    instinct_files = sorted(INSTINCTS_DIR.glob("*.md"))
    if not instinct_files:
        print("No instincts found yet.")
        print("  Instincts are created automatically as the observer detects patterns.")
        return

    print(f"Instincts ({len(instinct_files)} total)\n")
    print(f"{'Name':<30} {'Confidence':<30} {'Category'}")
    print("-" * 80)

    for f in instinct_files:
        content = f.read_text()
        metadata, body = parse_frontmatter(content)
        name = metadata.get("name", f.stem)
        confidence = float(metadata.get("confidence", 0))
        category = metadata.get("category", "general")
        bar = confidence_bar(confidence)
        print(f"{name:<30} {bar:<30} {category}")

    # Show observation stats
    print()
    if OBSERVATIONS_FILE.exists():
        line_count = sum(1 for _ in open(OBSERVATIONS_FILE))
        size_mb = OBSERVATIONS_FILE.stat().st_size / (1024 * 1024)
        print(f"Observations: {line_count} entries ({size_mb:.1f} MB)")
    else:
        print("Observations: none yet")


def cmd_import(args):
    """Import instincts from a file."""
    source = Path(args.file)
    if not source.exists():
        print(f"Error: File not found: {source}", file=sys.stderr)
        sys.exit(1)

    INSTINCTS_DIR.mkdir(parents=True, exist_ok=True)

    content = source.read_text()
    metadata, body = parse_frontmatter(content)

    if "name" not in metadata:
        metadata["name"] = source.stem

    # Assign default confidence for imported instincts
    if "confidence" not in metadata:
        metadata["confidence"] = 0.5

    dest = INSTINCTS_DIR / source.name
    if dest.exists() and not args.force:
        print(f"Instinct already exists: {dest.name}")
        print("  Use --force to overwrite.")
        return

    dest.write_text(content)
    print(f"Imported: {metadata['name']} (confidence: {metadata['confidence']})")
    print(f"  -> {dest}")


def cmd_export(args):
    """Export instincts to a portable format."""
    if not INSTINCTS_DIR.exists():
        print("No instincts to export.", file=sys.stderr)
        sys.exit(1)

    instinct_files = sorted(INSTINCTS_DIR.glob("*.md"))
    if not instinct_files:
        print("No instincts to export.", file=sys.stderr)
        sys.exit(1)

    export_data = {
        "exported_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "instinct_count": len(instinct_files),
        "instincts": [],
    }

    for f in instinct_files:
        content = f.read_text()
        metadata, body = parse_frontmatter(content)
        export_data["instincts"].append(
            {"filename": f.name, "metadata": metadata, "body": body}
        )

    output = Path(args.output) if args.output else Path("instincts-export.json")
    output.write_text(json.dumps(export_data, indent=2, default=str))
    print(f"Exported {len(instinct_files)} instincts to {output}")


def cmd_evolve(args):
    """Re-evaluate instinct confidence based on recent observations."""
    if not OBSERVATIONS_FILE.exists():
        print("No observations file found. Nothing to evolve from.")
        return

    if not INSTINCTS_DIR.exists():
        print("No instincts directory found. Nothing to evolve.")
        return

    instinct_files = list(INSTINCTS_DIR.glob("*.md"))
    if not instinct_files:
        print("No instincts to evolve.")
        return

    # Load recent observations
    observations = []
    with open(OBSERVATIONS_FILE) as f:
        for line in f:
            line = line.strip()
            if line:
                try:
                    observations.append(json.loads(line))
                except json.JSONDecodeError:
                    continue

    if not observations:
        print("No valid observations found.")
        return

    print(f"Analyzing {len(observations)} observations against {len(instinct_files)} instincts...\n")

    evolved_count = 0
    for instinct_path in instinct_files:
        content = instinct_path.read_text()
        metadata, body = parse_frontmatter(content)
        name = metadata.get("name", instinct_path.stem)
        old_confidence = float(metadata.get("confidence", 0.3))
        category = metadata.get("category", "general")

        # Count relevant observations based on instinct category/keywords
        keywords = [name.lower().replace("-", " ").replace("_", " ")]
        if "tool" in metadata:
            keywords.append(str(metadata["tool"]).lower())

        relevant_count = 0
        for obs in observations:
            obs_str = json.dumps(obs).lower()
            if any(kw in obs_str for kw in keywords):
                relevant_count += 1

        # Calculate new confidence based on observation frequency
        if relevant_count == 0:
            # Decay slightly if no recent evidence
            new_confidence = max(0.1, old_confidence - 0.05)
        elif relevant_count <= 3:
            new_confidence = min(0.5, old_confidence + 0.05)
        elif relevant_count <= 6:
            new_confidence = min(0.7, old_confidence + 0.1)
        else:
            new_confidence = min(0.85, old_confidence + 0.15)

        if abs(new_confidence - old_confidence) > 0.001:
            evolved_count += 1
            direction = "+" if new_confidence > old_confidence else "-"
            delta = abs(new_confidence - old_confidence)
            print(f"  {name}: {old_confidence:.0%} -> {new_confidence:.0%} ({direction}{delta:.0%})")

            # Update the instinct file
            metadata["confidence"] = round(new_confidence, 2)
            metadata["last_evolved"] = time.strftime("%Y-%m-%dT%H:%M:%S%z")

            # Rebuild the file
            fm_lines = ["---"]
            for k, v in metadata.items():
                fm_lines.append(f"{k}: {v}")
            fm_lines.append("---")
            new_content = "\n".join(fm_lines) + "\n\n" + body + "\n"
            instinct_path.write_text(new_content)

    if evolved_count == 0:
        print("No instincts needed updating.")
    else:
        print(f"\nEvolved {evolved_count} instinct(s).")


def main():
    parser = argparse.ArgumentParser(
        description="Manage instincts for the continuous learning system.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    # status
    sub_status = subparsers.add_parser("status", help="Show current instincts and confidence levels")
    sub_status.set_defaults(func=cmd_status)

    # import
    sub_import = subparsers.add_parser("import", help="Import instincts from a file")
    sub_import.add_argument("file", help="Path to the instinct file to import")
    sub_import.add_argument("--force", action="store_true", help="Overwrite existing instincts")
    sub_import.set_defaults(func=cmd_import)

    # export
    sub_export = subparsers.add_parser("export", help="Export instincts to a portable format")
    sub_export.add_argument("-o", "--output", help="Output file path (default: instincts-export.json)")
    sub_export.set_defaults(func=cmd_export)

    # evolve
    sub_evolve = subparsers.add_parser("evolve", help="Re-evaluate instinct confidence from observations")
    sub_evolve.set_defaults(func=cmd_evolve)

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(1)

    args.func(args)


if __name__ == "__main__":
    main()
