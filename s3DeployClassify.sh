
bucket=$1

cd ..

tar -czf theeye-mailbot.tgz theeye-mailbot-classify/

filename="theeye-mailbot-$(date +'%Y%m%d').tgz"

aws s3 cp theeye-mailbot.tgz "s3://${bucket}/${filename}" --acl public-read

url="https://${bucket}.s3.amazonaws.com/${filename}"

echo "download url is ${url}"
