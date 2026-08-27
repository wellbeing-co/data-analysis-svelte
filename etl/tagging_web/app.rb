require "sinatra/base"
require_relative "../lib/etl/tagging_review"
require_relative "../lib/etl/tagging_store"

module Etl
  # Local web tool that lets a non-technical reviewer - on another machine on
  # the same network - fill in the sleep_issue/stress_burnout/
  # acupuncture_referral/mental_health_referral tags from a browser instead
  # of opening a spreadsheet.
  #
  # Their edits are never written straight into the tagging CSV that stage 2
  # reads. Instead they're saved as a "pending" proposal and shown as a diff
  # for someone with repo access to review and merge - the same propose ->
  # review -> merge shape as a GitHub pull request, kept entirely local.
  #
  # HTTP Basic Auth is applied in config.ru, in front of this app.
  class TaggingWebApp < Sinatra::Base
    set :views, File.expand_path("views", __dir__)
    set :public_folder, File.expand_path("public", __dir__)

    helpers do
      def review_for(year)
        Etl::TaggingReview.new(year)
      end

      def tag_columns
        Etl::TaggingStore::TAG_COLUMNS
      end

      def blank_tag
        Etl::TaggingStore.blank_tag
      end
    end

    get "/" do
      @years = Etl::TaggingReview.years.map { |y| review_for(y) }
      erb :index
    end

    get "/:year/edit" do
      @year = params[:year]
      @review = review_for(@year)
      halt 404, "No tagging file for #{@year}" unless File.exist?(@review.tagging_path)
      @rows = @review.rows
      erb :edit
    end

    post "/:year/edit" do
      @year = params[:year]
      @review = review_for(@year)
      halt 404, "No tagging file for #{@year}" unless File.exist?(@review.tagging_path)

      submitted = (params[:tags] || {}).each_with_object({}) do |(id, columns), out|
        out[id] = columns.to_h
      end
      @review.propose!(submitted)

      redirect "/#{@year}/review"
    end

    get "/:year/review" do
      @year = params[:year]
      @review = review_for(@year)
      halt 404, "No tagging file for #{@year}" unless File.exist?(@review.tagging_path)
      @diff = @review.diff
      erb :review
    end

    post "/:year/merge" do
      @year = params[:year]
      review_for(@year).merge!
      redirect "/"
    end

    post "/:year/discard" do
      @year = params[:year]
      review_for(@year).discard!
      redirect "/#{@year}/edit"
    end
  end
end
