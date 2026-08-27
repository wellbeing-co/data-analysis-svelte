require "securerandom"
require "fileutils"

module Etl
  module Salt
    PATH = File.expand_path("../../config/salt.txt", __dir__)

    def self.value
      FileUtils.mkdir_p(File.dirname(PATH))
      File.write(PATH, SecureRandom.hex(32)) unless File.exist?(PATH)
      File.read(PATH).strip
    end
  end
end
