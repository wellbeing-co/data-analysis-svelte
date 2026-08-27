require "zip"
require "nokogiri"

module Etl
  # Low level reader for the .docx (OOXML) format.
  #
  # Walks word/document.xml and returns an ordered list of "blocks", where
  # each block is either a paragraph of text or a table of rows/cells. This
  # keeps the reader generic and independent of the specific report layout;
  # the report-specific field extraction lives in ReportExtractor.
  class DocxDocument
    W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main".freeze

    Block = Struct.new(:type, :text, :rows, keyword_init: true)

    attr_reader :blocks

    def initialize(path)
      @path = path
      @blocks = read_blocks
    end

    # Full document text, one paragraph per line, tables rendered as
    # pipe-separated rows. Useful for narrative/keyword searches.
    def full_text
      blocks.map do |block|
        if block.type == :paragraph
          block.text
        else
          block.rows.map { |row| row.join(" | ") }.join("\n")
        end
      end.join("\n")
    end

    def paragraphs
      blocks.select { |b| b.type == :paragraph }.map(&:text)
    end

    def tables
      blocks.select { |b| b.type == :table }.map(&:rows)
    end

    private

    def read_blocks
      xml = Zip::File.open(@path) { |zip| zip.read("word/document.xml") }
      doc = Nokogiri::XML(xml)
      body = doc.at_xpath("//w:body", "w" => W_NS)
      return [] unless body

      body.children.filter_map { |node| parse_node(node) }
    end

    def parse_node(node)
      case node.name
      when "p"
        Block.new(type: :paragraph, text: paragraph_text(node))
      when "tbl"
        Block.new(type: :table, rows: table_rows(node))
      end
    end

    def paragraph_text(p_node)
      text = +""
      p_node.xpath(".//w:t | .//w:tab | .//w:br", "w" => W_NS).each do |node|
        case node.name
        when "t"  then text << node.text
        when "tab" then text << "\t"
        when "br" then text << "\n"
        end
      end
      text.strip
    end

    def table_rows(tbl_node)
      tbl_node.xpath("./w:tr", "w" => W_NS).map do |tr|
        tr.xpath("./w:tc", "w" => W_NS).map do |tc|
          tc.xpath(".//w:p", "w" => W_NS).map { |p| paragraph_text(p) }.reject(&:empty?).join(" ")
        end
      end
    end
  end
end
