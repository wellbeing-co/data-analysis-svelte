require "csv"
require "fileutils"
require "time"
require_relative "tagging_store"

module Etl
  # Backs the "pull request"-style flow used by the local tagging web tool
  # (etl/tagging_web): a reviewer never edits etl/tagging/<year>_tagging.csv
  # directly from the browser. Instead their edits are saved as a "proposal"
  # (etl/tagging/pending/<year>_tagging.pending.csv), which someone with
  # access to the repo/machine then reviews as a diff and either merges into
  # the real tagging file or discards - the same shape as opening, reviewing
  # and merging a pull request, just entirely local.
  class TaggingReview
    TAGGING_DIR = File.expand_path("../../tagging", __dir__)
    PENDING_DIR = File.join(TAGGING_DIR, "pending")

    attr_reader :year

    def self.years
      Dir.glob(File.join(TAGGING_DIR, "*_tagging.csv")).map do |path|
        File.basename(path).sub(/_tagging\.csv\z/, "")
      end.sort
    end

    def initialize(year)
      @year = year
    end

    def tagging_path
      File.join(TAGGING_DIR, "#{@year}_tagging.csv")
    end

    def pending_path
      File.join(PENDING_DIR, "#{@year}_tagging.pending.csv")
    end

    def rows
      Etl::TaggingStore.load(tagging_path).values.sort_by { |r| r["pseudonymous_id"].to_s }
    end

    def pending?
      File.exist?(pending_path)
    end

    def pending_rows
      return {} unless pending?

      Etl::TaggingStore.load(pending_path)
    end

    def pending_meta
      return nil unless pending?

      { submitted_at: File.mtime(pending_path) }
    end

    # Called from the edit form: merges the submitted tag values on top of
    # the current tagging rows and writes the result as a pending proposal,
    # without touching the real tagging file.
    def propose!(submitted_tags)
      current = Etl::TaggingStore.load(tagging_path)

      updated = current.to_h do |id, row|
        next [id, row] unless submitted_tags.key?(id)

        merged = row.dup
        Etl::TaggingStore::TAG_COLUMNS.each do |column|
          value = submitted_tags.dig(id, column)
          merged[column] = value unless value.nil? || value.strip.empty?
        end
        [id, merged]
      end

      FileUtils.mkdir_p(PENDING_DIR)
      Etl::TaggingStore.write(pending_path, updated.values)
    end

    # Row-by-row, column-by-column differences between the current tagging
    # file and the pending proposal - what a reviewer sees before merging.
    def diff
      return [] unless pending?

      current = Etl::TaggingStore.load(tagging_path)
      proposed = pending_rows

      proposed.filter_map do |id, proposed_row|
        current_row = current[id] || {}
        changes = Etl::TaggingStore::TAG_COLUMNS.filter_map do |column|
          before = current_row[column]
          after = proposed_row[column]
          next if before == after

          { column: column, before: before, after: after }
        end

        next if changes.empty?

        {
          pseudonymous_id: id,
          source_file: proposed_row["source_file"],
          excerpt: proposed_row["personal_report_excerpt"],
          changes: changes
        }
      end
    end

    # Applies the pending proposal on top of the real tagging file (only the
    # tag columns are taken from the proposal) and removes the pending file
    # - equivalent to merging a pull request.
    def merge!
      return false unless pending?

      current = Etl::TaggingStore.load(tagging_path)
      proposed = pending_rows

      merged = current.to_h do |id, row|
        proposed_row = proposed[id]
        next [id, row] unless proposed_row

        new_row = row.dup
        Etl::TaggingStore::TAG_COLUMNS.each { |c| new_row[c] = proposed_row[c] }
        [id, new_row]
      end

      Etl::TaggingStore.write(tagging_path, merged.values)
      File.delete(pending_path)
      true
    end

    def discard!
      return false unless pending?

      File.delete(pending_path)
      true
    end
  end
end
