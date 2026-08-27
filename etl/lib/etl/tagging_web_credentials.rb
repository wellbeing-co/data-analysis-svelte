require "securerandom"
require "fileutils"

module Etl
  # Basic-auth credentials for the local tagging web tool (etl/tagging_web).
  #
  # Generated once on first run (same pattern as Etl::Salt) so the person
  # running `bin/tagging_server` can hand a username/password to the
  # non-technical reviewer without ever committing a secret to git.
  module TaggingWebCredentials
    PATH = File.expand_path("../../config/tagging_web_credentials.txt", __dir__)
    DEFAULT_USERNAME = "reviewer"

    Credentials = Struct.new(:username, :password)

    def self.load_or_create
      FileUtils.mkdir_p(File.dirname(PATH))

      unless File.exist?(PATH)
        File.write(PATH, "#{DEFAULT_USERNAME}:#{SecureRandom.alphanumeric(16)}\n")
        File.chmod(0o600, PATH)
      end

      username, password = File.read(PATH).strip.split(":", 2)
      Credentials.new(username, password)
    end
  end
end
