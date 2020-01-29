"""Scrape a list of new albums by artists I follow"""
import configparser
import spotipy
import spotipy.util as util

import os
import pickle
import datetime
import argparse

MIN_DAYS = 365
REDIRECT_URI = 'http://localhost:8888/callback'
USERNAME = '<username-here>'
REGION = 'CA'

if __name__ == "__main__":

    # Cache file path
    today = datetime.date.today()
    today_pickle = 'artists{}.pkl'.format(str(today))

    # Authenticate + Init
    token = util.prompt_for_user_token(
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
                and REGION in alb['available_markets']
                and alb['album_group'] == 'album'
            ]

        # Cache
        pickle.dump(artists, open(today_pickle, 'wb'))


    # TODO: similarity filter?

    # Get all the playlists that were released this year only
    pot_new_albums, names_seen = [], []
    for art in artists:
        for alb in art['albums']:
            if alb['release_date_precision'] == 'year':
                alb_date = datetime.date(
                    int(alb['release_date']), 1, 1)

            elif alb['release_date_precision'] == 'month':
                nums = alb['release_date'].split('-')
                alb_date = datetime.date(
                    int(nums[0]), int(nums[1]), 1)
            else:
                alb_date = datetime.datetime.fromisoformat(
                    alb['release_date']).date()

            # TODO: seems like we can get duplicates here. should fix in API!
            # NOTE: duplicates have different URIS so probably multiple releases
            # for canada
            if alb['name'] not in names_seen and abs(
                (today - alb_date).days < MIN_DAYS):
                alb['datetime'] = alb_date
                pot_new_albums.append(alb)
                names_seen.append(alb['name'])

    # Sort by most recent
    pot_new_albums.sort(key=lambda r: r['datetime'], reverse=True)

    # Print out
    print("\nNew albums from followed artists within past {} days:\n\n"
          "{:<10}   {:<53}   {:<25}   {:<40}\n"
          "-------------------------------------------------------"
          "-------------------------------------------------------"
          "---------------------------".format(
            MIN_DAYS, 'date', 'url', 'artist', 'name'))
    for alb in pot_new_albums:
        alb['url'] = 'https://open.spotify.com/album/' + alb[
            'uri'].split(':')[2]
        if len(alb['name']) > 40:
            alb['name'] = alb['name'][:37] + '...'
        print("{:<10}   {:<53}   {:<25}   {:<40}".format(
            alb['release_date'],
            alb['url'],
            alb['artists'][0]['name'],
            alb['name'],
        ))
