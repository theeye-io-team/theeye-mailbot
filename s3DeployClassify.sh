
if [ -z "${1+x}" ];
then
  name=`basename "$0"`
  echo "usage: "
  echo "   ${name} BUCKET"
  exit 1
fi

bucket=$1

cd /tmp

echo "cloning repo"
git clone git@github.com:theeye-io-team/theeye-mailbot.git 

echo "changing directory to theeye-mailbot"
cd theeye-mailbot

echo "fetching mailbot tags"
git fetch --tags

echo "installing dependencies"
npm install

version=$(git describe)
echo "version: ${version}"

echo "removing git history (.git)"
rm -rf ./.git

cd ..

filename="theeye-mailbot-${version}.tgz"
echo "creating tar ${filename}"

tar -czvf "${filename}" theeye-mailbot/

echo "uploading to aws-s3"

aws s3 cp "${filename}" "s3://${bucket}/${filename}" --acl public-read

url="https://${bucket}.s3.amazonaws.com/${filename}"

echo "download url is ${url}"

echo "removing temporal files"
rm -rf /tmp/theeye-mailbot/
rm -rf /tmp/theeye-mailbot/${filename}
