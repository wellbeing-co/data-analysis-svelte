require "rack"
require_relative "app"
require_relative "../lib/etl/tagging_web_credentials"

credentials = Etl::TaggingWebCredentials.load_or_create

use Rack::Auth::Basic, "Complete Wellbeing - Tagging review" do |username, password|
  Rack::Utils.secure_compare(username, credentials.username) &&
    Rack::Utils.secure_compare(password, credentials.password)
end

run Etl::TaggingWebApp
