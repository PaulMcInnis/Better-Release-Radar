"""Scrape a list of new albums by artists I follow on Spotify"""
import argparse
from datetime import datetime, date
import os
import pickle
import sys
import spotipy


# Inits
MIN_DAYS_DEFAULT = 182  # Look this far into the past by default
PRINT_URL = False # if False will print URI (copy-pasteable into desktop app)
HEADER = '\033[95m'
BOLD = '\033[1m'
GREEN = '\033[92m'
ENDC = '\033[0m'


# Config items: TODO: move below into a config
USERNAME = '358cfe6c7ce24c8e8914b43fa01e4746'
REDIRECT_URI = 'http://localhost:8888/callback' # TODO: host simpleHTTP on this? (vs. getting 404)
REGION = 'CA'


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Show releases by artists you follow on Spotify')
    parser.add_argument('--num-days', help='# of days after which results are omitted',
                        required=False, default=MIN_DAYS_DEFAULT, type=int)
    parser.add_argument('--hide-eps', action='store_true', help='don\'t show any EPs')
    args = parser.parse_args(sys.argv[1:])

    # We will retain a list of albums of these types
    allowed_groups = ['album']
    if not args.hide_eps:
        allowed_groups.append('single')

    # Cache file path
    today = date.today()
    today_pickle = 'artists{}.pkl'.format(str(today))

    # Authenticate + Init
    token = spotipy.util.prompt_for_user_token(
        USERNAME, 'user-follow-read', redirect_uri=REDIRECT_URI)
    assert token, "Spotify login unsuccessful"
    sp = spotipy.Spotify(auth=token)

    # Load or scrape following data
    if os.path.exists(today_pickle):
        print("Loaded existing scrape data from " + today_pickle)
        artists = pickle.load(open(today_pickle, 'rb'))
    else:
        print("Scraping user following data...")

        # Get all the artists you are following
        artists = sp.current_user_followed_artists()['artists']['items']
        while True:
            print("getting 20 followed artists... {}".format(artists[-1]['id']))
            new_artists = sp.current_user_followed_artists(
                after=artists[-1]['id'])
            if (not new_artists or not new_artists['artists']
                    or not new_artists['artists']['items']):
                break
            artists.extend(new_artists['artists']['items'])

        # Get all the albums by every artist
        for art in artists:
            print("getting albums for {}...".format(art['name']))
            try:
                new_albs = sp.artist_albums(art['id'], limit=50)['items']
            except:
                art['albums'] = {}
                continue
            art['albums'] = [
                alb for alb in new_albs if alb['type'] == 'album'
            ]

        # Cache
        pickle.dump(artists, open(today_pickle, 'wb'))

    # TODO: similarity filter?

    # Apply filters
    pot_new_albums, names_seen = [], []
    for art in artists:
        for alb in art['albums']:

            # Region and ep vs album filter
            if (REGION not in alb['available_markets'] or alb['album_group'] not in allowed_groups):
                continue

            # Date Filter
            if alb['release_date_precision'] == 'year':
                alb_date = date(int(alb['release_date']), 1, 1)

            elif alb['release_date_precision'] == 'month':
                nums = alb['release_date'].split('-')
                alb_date = date(int(nums[0]), int(nums[1]), 1)
            else:
                alb_date = datetime.fromisoformat(alb['release_date']).date()

            # TODO: seems like we can get duplicates here. should fix in API!
            # NOTE: duplicates have different URIS so probably multiple releases for canada
            if alb['name'] not in names_seen and abs(
                (today - alb_date).days < args.num_days):
                alb['datetime'] = alb_date
                pot_new_albums.append(alb)
                names_seen.append(alb['name'])
            #else:
            #    # generally albums are arranged by date
            #    break

    # Sort by most recent
    pot_new_albums.sort(key=lambda r: r['datetime'], reverse=True)

    # Header
    print("\nNew albums from followed artists within past {} days:\n\n"
          "{}{:<6}   {:<10}   {:<53}   {:<25}   {:<40}\n"
          "-------------------------------------------------------"
          "-------------------------------------------------------"
          "------------------------------{}".format(
            args.num_days, HEADER, 'type', 'date', 'url', 'artist', 'name', ENDC))

    # Print out
    for alb in pot_new_albums:
        if PRINT_URL:
            alb['url'] = 'https://open.spotify.com/album/' + alb['uri'].split(':')[2]
        if len(alb['name']) > 40:
            alb['name'] = alb['name'][:37] + '...'

        print("{}{:<6}   {:<10}   {:<53}   {:<25}   {:<40}{}".format(
            '' if alb['album_group'] == 'single' else BOLD + GREEN,
            alb['album_group'],
            alb['release_date'],
            alb['url'] if PRINT_URL else alb['uri'],
            alb['artists'][0]['name'],
            alb['name'],
            '' if alb['album_group'] == 'single' else ENDC,
        ))
